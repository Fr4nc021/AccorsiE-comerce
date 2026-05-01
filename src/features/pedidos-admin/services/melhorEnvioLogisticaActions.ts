"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { ensureMelhorEnvioAccessToken, generateShipmentLabel, purchaseShipment, requestShipmentDocuments } from "@/services/melhorEnvio";
import { createAdminClient } from "@/services/supabase/admin";

export type MelhorEnvioLogisticaActionState = {
  ok?: boolean;
  error?: string;
  info?: string;
  etiquetaUrl?: string;
  declaracaoConteudoUrl?: string;
};

type PedidoLogisticaRow = {
  id: string;
  melhor_envio_id: string | null;
};

async function getPedidoLogisticaRow(pedidoId: string): Promise<PedidoLogisticaRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pedidos")
    .select("id, melhor_envio_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as PedidoLogisticaRow | null) ?? null;
}

async function patchPedidoLogistica(
  pedidoId: string,
  patch: Record<string, string | null>,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("pedidos").update(patch).eq("id", pedidoId);
  if (error) {
    throw new Error(error.message);
  }
}

function getPedidoId(formData: FormData): string {
  return String(formData.get("pedido_id") ?? "").trim();
}

/** ID no formulário (submit atual) ou o já salvo no pedido. */
function resolveMelhorEnvioId(formData: FormData, saved: string | null): string {
  const fromForm = String(formData.get("melhor_envio_id") ?? "").trim();
  if (fromForm) return fromForm;
  return (saved ?? "").trim();
}

function resultError(message: string): MelhorEnvioLogisticaActionState {
  return { error: message };
}

function resolveFriendlyError(code: string): string {
  const map: Record<string, string> = {
    integration_disabled: "Integração Melhor Envio não configurada no servidor.",
    invalid_input: "Dados inválidos para a operação no Melhor Envio.",
    network_error: "Falha de rede ao acessar o Melhor Envio.",
    api_error: "Melhor Envio rejeitou a operação.",
    invalid_response: "Resposta inválida recebida do Melhor Envio.",
  };
  return map[code] ?? "Falha na operação com Melhor Envio.";
}

export async function comprarEnvioMelhorEnvioAction(
  _prev: MelhorEnvioLogisticaActionState | null,
  formData: FormData,
): Promise<MelhorEnvioLogisticaActionState> {
  await requireAdmin();
  const pedidoId = getPedidoId(formData);
  if (!pedidoId) return resultError("Pedido inválido.");

  const pedido = await getPedidoLogisticaRow(pedidoId);
  if (!pedido) return resultError("Pedido não encontrado.");
  const melhorEnvioId = resolveMelhorEnvioId(formData, pedido.melhor_envio_id);
  if (!melhorEnvioId) {
    return resultError("Preencha o ID Melhor Envio no campo acima (não é necessário clicar em Salvar antes).");
  }
  if (melhorEnvioId !== (pedido.melhor_envio_id ?? "").trim()) {
    await patchPedidoLogistica(pedidoId, { melhor_envio_id: melhorEnvioId });
  }

  const token = await ensureMelhorEnvioAccessToken();
  const result = await purchaseShipment(melhorEnvioId, { token });
  if (!result.ok) {
    return resultError(`${resolveFriendlyError(result.code)} ${result.message}`);
  }

  await patchPedidoLogistica(pedidoId, {
    frete_provedor: "melhor_envio",
    rastreio_codigo: result.rastreioCodigo ?? null,
    rastreio_url: result.rastreioUrl ?? null,
  });

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  return { ok: true, info: "Envio comprado no Melhor Envio." };
}

export async function gerarEtiquetaMelhorEnvioAction(
  _prev: MelhorEnvioLogisticaActionState | null,
  formData: FormData,
): Promise<MelhorEnvioLogisticaActionState> {
  await requireAdmin();
  const pedidoId = getPedidoId(formData);
  if (!pedidoId) return resultError("Pedido inválido.");

  const pedido = await getPedidoLogisticaRow(pedidoId);
  if (!pedido) return resultError("Pedido não encontrado.");
  const melhorEnvioId = resolveMelhorEnvioId(formData, pedido.melhor_envio_id);
  if (!melhorEnvioId) {
    return resultError("Preencha o ID Melhor Envio no campo acima (não é necessário clicar em Salvar antes).");
  }
  if (melhorEnvioId !== (pedido.melhor_envio_id ?? "").trim()) {
    await patchPedidoLogistica(pedidoId, { melhor_envio_id: melhorEnvioId });
  }

  const token = await ensureMelhorEnvioAccessToken();
  const result = await generateShipmentLabel(melhorEnvioId, { token });
  if (!result.ok) {
    return resultError(`${resolveFriendlyError(result.code)} ${result.message}`);
  }

  await patchPedidoLogistica(pedidoId, {
    melhor_envio_etiqueta_url: result.etiquetaUrl ?? null,
    rastreio_codigo: result.rastreioCodigo ?? null,
    rastreio_url: result.rastreioUrl ?? null,
    frete_provedor: "melhor_envio",
  });

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  return {
    ok: true,
    info: "Etiqueta solicitada no Melhor Envio.",
    etiquetaUrl: result.etiquetaUrl,
    declaracaoConteudoUrl: result.declaracaoConteudoUrl,
  };
}

export async function imprimirDocumentosMelhorEnvioAction(
  _prev: MelhorEnvioLogisticaActionState | null,
  formData: FormData,
): Promise<MelhorEnvioLogisticaActionState> {
  await requireAdmin();
  const pedidoId = getPedidoId(formData);
  if (!pedidoId) return resultError("Pedido inválido.");

  const pedido = await getPedidoLogisticaRow(pedidoId);
  if (!pedido) return resultError("Pedido não encontrado.");
  const melhorEnvioId = resolveMelhorEnvioId(formData, pedido.melhor_envio_id);
  if (!melhorEnvioId) {
    return resultError("Preencha o ID Melhor Envio no campo acima (não é necessário clicar em Salvar antes).");
  }
  if (melhorEnvioId !== (pedido.melhor_envio_id ?? "").trim()) {
    await patchPedidoLogistica(pedidoId, { melhor_envio_id: melhorEnvioId });
  }

  const token = await ensureMelhorEnvioAccessToken();
  const result = await requestShipmentDocuments(melhorEnvioId, { token });
  if (!result.ok) {
    return resultError(`${resolveFriendlyError(result.code)} ${result.message}`);
  }

  await patchPedidoLogistica(pedidoId, {
    melhor_envio_etiqueta_url: result.etiquetaUrl ?? null,
    rastreio_codigo: result.rastreioCodigo ?? null,
    rastreio_url: result.rastreioUrl ?? null,
    frete_provedor: "melhor_envio",
  });

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  return {
    ok: true,
    info: "Link de impressão recebido do Melhor Envio.",
    etiquetaUrl: result.etiquetaUrl,
    declaracaoConteudoUrl: result.declaracaoConteudoUrl,
  };
}
