import { mercadoPagoAmountMatchesPedidoTotal } from "@/services/mercadopago/amountsMatch";
import {
  getPayment,
  searchPaymentsByExternalReference,
  type MercadoPagoPaymentResource,
} from "@/services/mercadopago/client";
import { sendPedidoTransactionalEmail } from "@/services/email/transactionalPedidoEmail";
import { createAdminClient } from "@/services/supabase/admin";

function parseMpDate(s: string | null | undefined): number {
  if (!s?.trim()) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function pickPaymentForPedido(
  results: MercadoPagoPaymentResource[],
  pedidoId: string,
  total: string | number,
): MercadoPagoPaymentResource | null {
  const id = pedidoId.trim();
  const matching = results.filter((p) => {
    const ref = (p.external_reference ?? "").trim();
    if (ref !== id) return false;
    if (p.currency_id && p.currency_id !== "BRL") return false;
    const tx = p.transaction_amount;
    if (typeof tx !== "number" || !Number.isFinite(tx)) return false;
    return mercadoPagoAmountMatchesPedidoTotal(tx, total);
  });
  if (matching.length === 0) return null;
  const approved = matching.find((p) => p.status === "approved");
  if (approved) return approved;
  matching.sort(
    (a, b) =>
      parseMpDate(b.date_last_updated ?? b.date_created) -
      parseMpDate(a.date_last_updated ?? a.date_created),
  );
  return matching[0] ?? null;
}

export type SincronizarMpPedidoResult =
  | { ok: true; message: string; action?: string }
  | { ok: false; message: string };

/**
 * Reconsulta o Mercado Pago e aplica o mesmo fluxo do webhook (`mercadopago_aplicar_estado_pagamento`).
 * Útil quando a notificação não chegou ou falhou assinatura/URL.
 */
export async function sincronizarPagamentoMercadoPagoPedido(
  pedidoId: string,
): Promise<SincronizarMpPedidoResult> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return { ok: false, message: "Servidor sem MERCADOPAGO_ACCESS_TOKEN." };
  }

  const admin = createAdminClient();
  const { data: pedido, error: pedidoError } = await admin
    .from("pedidos")
    .select("id, total, mercadopago_payment_id, user_id")
    .eq("id", pedidoId)
    .maybeSingle();

  if (pedidoError || !pedido) {
    return { ok: false, message: "Pedido não encontrado." };
  }

  let payment: MercadoPagoPaymentResource | null = null;
  const savedId = (pedido.mercadopago_payment_id as string | null)?.trim() ?? "";

  if (savedId) {
    const mp = await getPayment(savedId, { accessToken });
    if (mp.ok) {
      payment = mp.payment;
    } else if (mp.status === 404) {
      payment = null;
    } else {
      return { ok: false, message: `Mercado Pago (ID salvo): ${mp.detail}` };
    }
  }

  if (!payment) {
    const search = await searchPaymentsByExternalReference(pedido.id, { accessToken });
    if (!search.ok) {
      return { ok: false, message: `Busca no Mercado Pago: ${search.detail}` };
    }
    payment = pickPaymentForPedido(search.results, pedido.id, pedido.total);
    if (!payment) {
      return {
        ok: false,
        message:
          savedId
            ? "Pagamento não encontrado pelo ID salvo (404) e nenhum pagamento com external_reference e valor compatíveis com este pedido."
            : "Nenhum pagamento encontrado no Mercado Pago com external_reference igual a este pedido e valor total compatível.",
      };
    }
  }

  const extRef = payment.external_reference?.trim() ?? "";
  if (extRef !== pedido.id) {
    return {
      ok: false,
      message: "O pagamento retornado não referencia este pedido (external_reference).",
    };
  }

  if (payment.currency_id && payment.currency_id !== "BRL") {
    return { ok: false, message: "Moeda do pagamento diferente de BRL; sincronização ignorada." };
  }

  const txAmount = payment.transaction_amount;
  if (typeof txAmount !== "number" || !Number.isFinite(txAmount)) {
    return { ok: false, message: "Pagamento sem transaction_amount válido." };
  }

  if (!mercadoPagoAmountMatchesPedidoTotal(txAmount, pedido.total)) {
    return {
      ok: false,
      message:
        "O valor pago no Mercado Pago não confere com o total do pedido (diferença acima da tolerância de 1 centavo).",
    };
  }

  const status = typeof payment.status === "string" ? payment.status : "";
  if (!status) {
    return { ok: false, message: "Pagamento sem status no Mercado Pago." };
  }

  const paymentIdStr = String(payment.id ?? savedId).trim();
  if (!paymentIdStr) {
    return { ok: false, message: "Pagamento sem ID no Mercado Pago." };
  }

  const { data: rpcResult, error: rpcError } = await admin.rpc("mercadopago_aplicar_estado_pagamento", {
    p_pedido_id: pedido.id,
    p_mp_payment_id: paymentIdStr,
    p_mp_status: status,
  });

  if (rpcError) {
    return { ok: false, message: rpcError.message };
  }

  const row = rpcResult as { ok?: boolean; error?: string; action?: string } | null;
  if (row && row.ok === false && row.error === "estoque_insuficiente") {
    return {
      ok: false,
      message:
        "Estoque insuficiente ao tentar confirmar o pagamento. Ajuste o estoque ou o pedido antes de sincronizar de novo.",
    };
  }

  const action = typeof row?.action === "string" ? row.action : undefined;

  if (status === "approved") {
    try {
      const { data: pedidoCliente } = await admin
        .from("pedidos")
        .select("user_id, total")
        .eq("id", pedido.id)
        .maybeSingle();

      if (pedidoCliente?.user_id) {
        const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(
          pedidoCliente.user_id as string,
        );
        if (!authErr && authUser?.user?.email) {
          await sendPedidoTransactionalEmail(admin, {
            pedidoId: pedido.id,
            kind: "pagamento_confirmado",
            toEmail: authUser.user.email,
            total: pedidoCliente.total as string | number,
          });
        }
      }
    } catch (e) {
      console.error("[email] pagamento confirmado (sync):", e instanceof Error ? e.message : e);
    }
  }

  const labels: Record<string, string> = {
    paid: "Pagamento confirmado e pedido atualizado para pago.",
    pending: "Status atualizado no pedido: pagamento ainda pendente no Mercado Pago.",
    failed: "Pagamento recusado/cancelado; pedido marcado como falha de pagamento.",
    noop: "Nenhuma alteração necessária (estado já refletia o pagamento).",
    skipped: "Pagamento aprovado, mas o pedido não estava aguardando pagamento (não alteramos o status).",
    refunded: "Pedido atualizado para reembolsado.",
    updated: "Dados do Mercado Pago atualizados no pedido.",
  };

  const base = action ? (labels[action] ?? `Ação: ${action}.`) : "Sincronização concluída.";
  return { ok: true, message: `${base} Status MP: ${status}.`, action };
}
