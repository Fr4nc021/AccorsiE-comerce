"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { sincronizarPagamentoMercadoPagoPedido } from "@/features/pedidos-admin/services/sincronizarPagamentoMercadoPagoPedido";

export type SincronizarPagamentoActionState = {
  ok?: boolean;
  error?: string;
  info?: string;
};

function getPedidoId(formData: FormData): string {
  return String(formData.get("pedido_id") ?? "").trim();
}

export async function sincronizarPagamentoMercadoPagoAction(
  _prev: SincronizarPagamentoActionState | null,
  formData: FormData,
): Promise<SincronizarPagamentoActionState> {
  await requireAdmin();
  const pedidoId = getPedidoId(formData);
  if (!pedidoId) {
    return { error: "Pedido inválido." };
  }

  const result = await sincronizarPagamentoMercadoPagoPedido(pedidoId);
  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  return { ok: true, info: result.message };
}
