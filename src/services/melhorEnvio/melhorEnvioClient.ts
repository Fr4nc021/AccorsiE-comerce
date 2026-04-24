/**
 * Cliente Melhor Envio — cotação via POST /api/v2/me/shipment/calculate.
 * O Bearer deve ser injetado em `config.token` (OAuth + ensureMelhorEnvioAccessToken ou legado MELHOR_ENVIO_TOKEN).
 */

import {
  melhorEnvioAuthorizedJsonHeaders,
  resolveMelhorEnvioOAuthBaseUrl,
} from "./oauthToken";
import type {
  MelhorEnvioCreateOrderInput,
  MelhorEnvioCreateOrderResult,
  MelhorEnvioDimensions,
  MelhorEnvioQuoteInput,
  MelhorEnvioQuoteOption,
  MelhorEnvioQuoteResult,
  MelhorEnvioShipmentActionResult,
} from "./types";

export const MELHOR_ENVIO_DISABLED_MESSAGE =
  "Integração Melhor Envio desabilitada (token de acesso ausente).";

const NOT_IMPLEMENTED_MESSAGE =
  "Chamada à API Melhor Envio ainda não implementada.";

export type MelhorEnvioClientConfig = {
  /** Bearer token da API (servidor apenas). */
  token?: string;
  /** Quando a API distinguir ambientes; usado só em getMelhorEnvioConfigFromEnv. */
  sandbox?: boolean;
};

type CalculateRow = {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  custom_price?: unknown;
  custom_delivery_time?: unknown;
  delivery_time?: unknown;
  custom_delivery_range?: { min?: unknown; max?: unknown };
  delivery_range?: { min?: unknown; max?: unknown };
  company?: { name?: unknown };
  error?: unknown;
};

function integrationDisabled(): Extract<MelhorEnvioQuoteResult, { ok: false }> {
  return {
    ok: false,
    code: "integration_disabled",
    message: MELHOR_ENVIO_DISABLED_MESSAGE,
  };
}

function notImplemented(): Extract<MelhorEnvioQuoteResult, { ok: false }> {
  return {
    ok: false,
    code: "not_implemented",
    message: NOT_IMPLEMENTED_MESSAGE,
  };
}

function quoteFail(
  code: "invalid_input" | "network_error" | "api_error" | "invalid_response",
  message: string,
): Extract<MelhorEnvioQuoteResult, { ok: false }> {
  return { ok: false, code, message };
}

function isEnabled(config: MelhorEnvioClientConfig): boolean {
  return Boolean(config.token?.trim());
}

function resolveShipmentCalculateUrl(): string {
  const explicit = process.env.MELHOR_ENVIO_API_BASE_URL?.trim();
  const base = explicit
    ? explicit.replace(/\/$/, "")
    : resolveMelhorEnvioOAuthBaseUrl();
  return `${base}/api/v2/me/shipment/calculate`;
}

function normalizeCep(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) {
    return null;
  }
  return digits;
}

function brlStringToCentavos(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const s = typeof value === "number" ? String(value) : String(value).trim();
  if (!s) {
    return null;
  }
  const n = Number.parseFloat(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.round(n * 100);
}

function deliveryDaysFromRow(row: CalculateRow): number | undefined {
  const direct =
    typeof row.custom_delivery_time === "number"
      ? row.custom_delivery_time
      : typeof row.delivery_time === "number"
        ? row.delivery_time
        : undefined;
  if (direct !== undefined && Number.isFinite(direct) && direct >= 0) {
    return Math.round(direct);
  }
  const range = row.custom_delivery_range ?? row.delivery_range;
  if (
    range &&
    typeof range.min === "number" &&
    typeof range.max === "number" &&
    Number.isFinite(range.min) &&
    Number.isFinite(range.max)
  ) {
    return Math.round((range.min + range.max) / 2);
  }
  return undefined;
}

function mapRowToOption(row: CalculateRow): MelhorEnvioQuoteOption | null {
  if (row.error !== undefined && row.error !== null && row.error !== "") {
    return null;
  }
  const idRaw = row.id;
  if (idRaw === undefined || idRaw === null) {
    return null;
  }
  const id = String(idRaw);
  const priceCentavos =
    brlStringToCentavos(row.custom_price) ?? brlStringToCentavos(row.price);
  if (priceCentavos === null) {
    return null;
  }
  const serviceName =
    typeof row.name === "string" && row.name.trim()
      ? row.name.trim()
      : "Serviço";
  const companyName =
    typeof row.company?.name === "string" && row.company.name.trim()
      ? row.company.name.trim()
      : "";
  const nome = companyName
    ? `${companyName} · ${serviceName}`
    : serviceName;
  return {
    id,
    nome,
    precoCentavos: priceCentavos,
    prazoDiasUteis: deliveryDaysFromRow(row),
  };
}

function parseCalculateBody(json: unknown): MelhorEnvioQuoteOption[] {
  if (!Array.isArray(json)) {
    return [];
  }
  const out: MelhorEnvioQuoteOption[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const opt = mapRowToOption(item as CalculateRow);
    if (opt) {
      out.push(opt);
    }
  }
  return out;
}

function buildCalculatePayload(
  input: MelhorEnvioQuoteInput,
  cepOrigemNorm: string,
  cepDestinoNorm: string,
) {
  const products = input.linhas.map((line) => {
    const { dimensoes } = line;
    const insuranceReais =
      line.valorDeclaradoCentavos !== undefined
        ? Math.round(line.valorDeclaradoCentavos) / 100
        : 0;
    return {
      id: line.produtoId,
      width: dimensoes.larguraCm,
      height: dimensoes.alturaCm,
      length: dimensoes.comprimentoCm,
      weight: dimensoes.pesoKg,
      insurance_value: Number(Math.max(0, insuranceReais).toFixed(2)),
      quantity: line.quantidade,
    };
  });

  return {
    from: { postal_code: cepOrigemNorm },
    to: { postal_code: cepDestinoNorm },
    products,
    options: {
      receipt: false,
      own_hand: false,
    },
  };
}

function validateDimensions(d: MelhorEnvioDimensions): string | null {
  const { alturaCm, larguraCm, comprimentoCm, pesoKg } = d;
  const vals = [alturaCm, larguraCm, comprimentoCm, pesoKg];
  for (const v of vals) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
      return "Dimensões ou peso inválidos para cotação.";
    }
  }
  return null;
}

function shipmentFail(
  code: "invalid_input" | "network_error" | "api_error" | "invalid_response",
  message: string,
): Extract<MelhorEnvioShipmentActionResult, { ok: false }> {
  return { ok: false, code, message };
}

function normalizeShipmentId(raw: string): string {
  return raw.trim();
}

function parseFirstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }
      if (item && typeof item === "object") {
        const nested = parseFirstString((item as Record<string, unknown>).url);
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

async function postShipmentAction(
  path: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<{ ok: true; json: unknown } | Extract<MelhorEnvioShipmentActionResult, { ok: false }>> {
  const base = resolveMelhorEnvioOAuthBaseUrl();
  const url = `${base}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: melhorEnvioAuthorizedJsonHeaders(token),
      body: JSON.stringify(payload),
    });
  } catch {
    return shipmentFail("network_error", "Falha de rede ao comunicar com o Melhor Envio.");
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return shipmentFail(
      "invalid_response",
      `Resposta inválida do Melhor Envio (${path}).`,
    );
  }

  if (!response.ok) {
    return shipmentFail(
      "api_error",
      `Melhor Envio rejeitou a solicitação (${path}, HTTP ${response.status}).`,
    );
  }
  return { ok: true, json };
}

function parseShipmentActionJson(melhorEnvioId: string, json: unknown): MelhorEnvioShipmentActionResult {
  const obj =
    json && typeof json === "object" ? (json as Record<string, unknown>) : {};

  const etiquetaUrl =
    parseFirstString(obj.label) ??
    parseFirstString(obj.labels) ??
    parseFirstString(obj.url) ??
    parseFirstString(obj.link);
  const declaracaoConteudoUrl =
    parseFirstString(obj.content_declaration) ??
    parseFirstString(obj.declaration) ??
    parseFirstString(obj.declaration_url);
  const rastreioCodigo =
    parseFirstString(obj.tracking) ??
    parseFirstString(obj.tracking_code);
  const rastreioUrl =
    parseFirstString(obj.tracking_url) ??
    parseFirstString(obj.trackingLink);

  return {
    ok: true,
    melhorEnvioId,
    etiquetaUrl,
    declaracaoConteudoUrl,
    rastreioCodigo,
    rastreioUrl,
  };
}

/**
 * Lê configuração das variáveis de ambiente (uso em servidor).
 */
export function getMelhorEnvioConfigFromEnv(): MelhorEnvioClientConfig {
  return {
    token: process.env.MELHOR_ENVIO_TOKEN,
    sandbox: process.env.MELHOR_ENVIO_SANDBOX === "true",
  };
}

/**
 * Cota frete. Sem token: `integration_disabled`. Com token: POST shipment/calculate com Bearer injetado.
 */
export async function quoteShipment(
  input: MelhorEnvioQuoteInput,
  config: MelhorEnvioClientConfig = getMelhorEnvioConfigFromEnv(),
): Promise<MelhorEnvioQuoteResult> {
  if (!isEnabled(config)) {
    return integrationDisabled();
  }

  const token = config.token!.trim();

  const cepOrigem = normalizeCep(input.cepOrigem);
  const cepDestino = normalizeCep(input.cepDestino);
  if (!cepOrigem || !cepDestino) {
    return quoteFail("invalid_input", "CEP de origem ou destino inválido.");
  }

  if (!input.linhas.length) {
    return quoteFail("invalid_input", "Informe ao menos um produto para cotar o frete.");
  }
  for (const line of input.linhas) {
    if (
      typeof line.quantidade !== "number" ||
      !Number.isInteger(line.quantidade) ||
      line.quantidade < 1
    ) {
      return quoteFail("invalid_input", "Quantidade inválida em um dos itens.");
    }
    const dimErr = validateDimensions(line.dimensoes);
    if (dimErr) {
      return quoteFail("invalid_input", dimErr);
    }
  }

  const url = resolveShipmentCalculateUrl();
  const body = buildCalculatePayload(input, cepOrigem, cepDestino);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: melhorEnvioAuthorizedJsonHeaders(token),
      body: JSON.stringify(body),
    });
  } catch {
    console.error("[Melhor Envio] shipment/calculate: falha de rede.");
    return quoteFail(
      "network_error",
      "Não foi possível contatar o Melhor Envio. Tente novamente.",
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    console.error(
      `[Melhor Envio] shipment/calculate: corpo inválido (HTTP ${response.status}).`,
    );
    return quoteFail(
      "invalid_response",
      "Resposta inválida do Melhor Envio ao calcular frete.",
    );
  }

  if (!response.ok) {
    console.error(
      `[Melhor Envio] shipment/calculate rejeitado (HTTP ${response.status}).`,
    );
    return quoteFail(
      "api_error",
      "O Melhor Envio rejeitou o cálculo de frete.",
    );
  }

  const opcoes = parseCalculateBody(json);
  if (opcoes.length === 0) {
    return quoteFail(
      "invalid_response",
      "Nenhuma opção de frete retornada pelo Melhor Envio.",
    );
  }

  return { ok: true, opcoes };
}

/**
 * Gera pedido/envio na Melhor Envio. Ainda não implementado.
 */
export async function createOrder(
  _input: MelhorEnvioCreateOrderInput,
  config: MelhorEnvioClientConfig = getMelhorEnvioConfigFromEnv(),
): Promise<MelhorEnvioCreateOrderResult> {
  if (!isEnabled(config)) {
    return {
      ok: false,
      code: "integration_disabled",
      message: MELHOR_ENVIO_DISABLED_MESSAGE,
    };
  }
  return {
    ok: false,
    code: "not_implemented",
    message: NOT_IMPLEMENTED_MESSAGE,
  };
}

export async function purchaseShipment(
  shipmentId: string,
  config: MelhorEnvioClientConfig = getMelhorEnvioConfigFromEnv(),
): Promise<MelhorEnvioShipmentActionResult> {
  if (!isEnabled(config)) {
    return {
      ok: false,
      code: "integration_disabled",
      message: MELHOR_ENVIO_DISABLED_MESSAGE,
    };
  }
  const id = normalizeShipmentId(shipmentId);
  if (!id) {
    return shipmentFail("invalid_input", "ID do envio Melhor Envio é obrigatório.");
  }
  const res = await postShipmentAction(
    "/api/v2/me/shipment/checkout",
    { orders: [id] },
    config.token!.trim(),
  );
  if (!res.ok) return res;
  return parseShipmentActionJson(id, res.json);
}

export async function generateShipmentLabel(
  shipmentId: string,
  config: MelhorEnvioClientConfig = getMelhorEnvioConfigFromEnv(),
): Promise<MelhorEnvioShipmentActionResult> {
  if (!isEnabled(config)) {
    return {
      ok: false,
      code: "integration_disabled",
      message: MELHOR_ENVIO_DISABLED_MESSAGE,
    };
  }
  const id = normalizeShipmentId(shipmentId);
  if (!id) {
    return shipmentFail("invalid_input", "ID do envio Melhor Envio é obrigatório.");
  }
  const res = await postShipmentAction(
    "/api/v2/me/shipment/generate",
    { orders: [id] },
    config.token!.trim(),
  );
  if (!res.ok) return res;
  return parseShipmentActionJson(id, res.json);
}

export async function requestShipmentDocuments(
  shipmentId: string,
  config: MelhorEnvioClientConfig = getMelhorEnvioConfigFromEnv(),
): Promise<MelhorEnvioShipmentActionResult> {
  if (!isEnabled(config)) {
    return {
      ok: false,
      code: "integration_disabled",
      message: MELHOR_ENVIO_DISABLED_MESSAGE,
    };
  }
  const id = normalizeShipmentId(shipmentId);
  if (!id) {
    return shipmentFail("invalid_input", "ID do envio Melhor Envio é obrigatório.");
  }
  const res = await postShipmentAction(
    "/api/v2/me/shipment/print",
    { mode: "private", orders: [id] },
    config.token!.trim(),
  );
  if (!res.ok) return res;
  return parseShipmentActionJson(id, res.json);
}
