/**
 * Cliente HTTP para a API FIPE v2 (Parallelum).
 * Documentação: https://fipe.parallelum.com.br — use token em FIPE_SUBSCRIPTION_TOKEN (header X-Subscription-Token).
 */

const FIPE_API_BASE = "https://fipe.parallelum.com.br/api/v2";

export type FipeFetchResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; message: string };

function fipeHeaders(token: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) h["X-Subscription-Token"] = token;
  return h;
}

/** Códigos de marca/modelo/ano na URL (evita path injection). */
export function isSafeFipePathSegment(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value) && value.length <= 64;
}

/**
 * Monta URL permitida para GET. Retorna null se o caminho não for suportado.
 */
export function resolveParallelumGetUrl(segments: string[]): string | null {
  if (segments.length === 0) return null;

  if (segments.length === 1 && segments[0] === "references") {
    return `${FIPE_API_BASE}/references`;
  }

  if (segments.length === 2 && segments[0] === "cars" && segments[1] === "brands") {
    return `${FIPE_API_BASE}/cars/brands`;
  }

  if (
    segments.length === 4 &&
    segments[0] === "cars" &&
    segments[1] === "brands" &&
    segments[3] === "models" &&
    isSafeFipePathSegment(segments[2])
  ) {
    const brand = encodeURIComponent(segments[2]);
    return `${FIPE_API_BASE}/cars/brands/${brand}/models`;
  }

  if (
    segments.length === 6 &&
    segments[0] === "cars" &&
    segments[1] === "brands" &&
    segments[3] === "models" &&
    segments[5] === "years" &&
    isSafeFipePathSegment(segments[2]) &&
    isSafeFipePathSegment(segments[4])
  ) {
    const brand = encodeURIComponent(segments[2]);
    const model = encodeURIComponent(segments[4]);
    return `${FIPE_API_BASE}/cars/brands/${brand}/models/${model}/years`;
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * GET com pausa entre tentativas e backoff em 429 / mensagem de limite (alinhado ao seed `.mjs`).
 */
export async function fetchParallelumJsonWithRetry(
  url: string,
  token: string,
  options: { delayMs?: number; maxAttempts?: number } = {},
): Promise<FipeFetchResult> {
  const delayMs = options.delayMs ?? 400;
  const maxAttempts = options.maxAttempts ?? 16;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delayMs > 0) await sleep(delayMs);
    const result = await fetchParallelumJson(url, token);
    if (result.ok) return result;
    const rateLimited =
      result.status === 429 || /taxa|rate|limite/i.test(result.message);
    if (!rateLimited) return result;
    const wait = Math.min(120_000, 2500 * 2 ** attempt);
    await sleep(wait);
  }
  return { ok: false, status: 429, message: "Limite de taxa na API FIPE após várias tentativas." };
}

export async function fetchParallelumJson(url: string, token: string): Promise<FipeFetchResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: fipeHeaders(token),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, message: "Falha de rede ao consultar a FIPE." };
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      data &&
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : text.slice(0, 200) || `HTTP ${res.status}`;
    return { ok: false, status: res.status, message: msg };
  }

  if (data && typeof data === "object" && data !== null && "error" in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "string" && err.trim()) {
      return { ok: false, status: res.status, message: err };
    }
  }

  return { ok: true, data };
}
