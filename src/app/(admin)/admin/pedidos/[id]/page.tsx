import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MelhorEnvioSaldoPanel } from "@/features/pedidos-admin/components/MelhorEnvioSaldoPanel";
import { PedidoLogisticaForm } from "@/features/pedidos-admin/components/PedidoLogisticaForm";
import { PedidoMercadoPagoSyncButton } from "@/features/pedidos-admin/components/PedidoMercadoPagoSyncButton";
import { getPedidoAdminByIdWithItens } from "@/features/pedidos-admin/services/getPedidoAdminByIdWithItens";
import { ensureMelhorEnvioAccessToken, fetchMelhorEnvioBalance } from "@/services/melhorEnvio";
import {
  formatCep,
  formatPedidoDate,
  formatPedidoMoney,
  formatPedidoStatus,
} from "@/features/pedidos/utils/pedidoDisplay";
import { isUuid } from "@/features/pedidos/utils/isUuid";
import type { PedidoLogisticaStatus } from "@/types/pedido";

type PageProps = { params: Promise<{ id: string }> };

const logisticaLabel: Record<PedidoLogisticaStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_separacao: "Em separação",
  postado: "Postado",
  entregue: "Entregue",
};

async function loadMelhorEnvioSaldoInicial(): Promise<{
  data: { balance: number; reserved: number; debts: number } | null;
  error: string | null;
}> {
  try {
    const token = await ensureMelhorEnvioAccessToken();
    const res = await fetchMelhorEnvioBalance(token);
    if (!res.ok) {
      return { data: null, error: res.message };
    }
    return {
      data: { balance: res.balance, reserved: res.reserved, debts: res.debts },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Não foi possível carregar o saldo do Melhor Envio.",
    };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: isUuid(id) ? `Pedido ${id.slice(0, 8)}… | Admin` : "Pedido | Admin",
  };
}

export default async function AdminPedidoDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  let pedido;
  try {
    pedido = await getPedidoAdminByIdWithItens(id);
  } catch {
    throw new Error("Não foi possível carregar o pedido. Verifique SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!pedido) {
    notFound();
  }

  const meSaldo = await loadMelhorEnvioSaldoInicial();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/pedidos"
          className="text-sm font-medium text-admin-accent hover:underline"
        >
          ← Voltar aos pedidos
        </Link>
      </div>

      <div className="flex flex-col gap-3 border-b border-gray-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Pedido</p>
          <p className="mt-1 break-all font-mono text-sm text-gray-900">{pedido.id}</p>
          <p className="mt-2 text-sm text-gray-500">{formatPedidoDate(pedido.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
              pedido.status === "pago"
                ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                : pedido.status === "aguardando_pagamento"
                  ? "bg-amber-50 text-amber-950 ring-amber-200"
                  : "bg-gray-100 text-gray-700 ring-gray-200"
            }`}
          >
            {formatPedidoStatus(pedido.status)}
          </span>
          <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-sky-200 ring-inset">
            {logisticaLabel[pedido.logistica_status]}
          </span>
        </div>
      </div>

      <section className="grid gap-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Cliente</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">E-mail da conta</dt>
              <dd className="font-medium text-gray-900">{pedido.cliente_email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ID do usuário</dt>
              <dd className="break-all font-mono text-xs text-gray-700">{pedido.user_id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Nome (entrega)</dt>
              <dd className="font-medium text-gray-900">{pedido.destinatario_nome}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Telefone</dt>
              <dd className="text-gray-900">{pedido.telefone}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Pagamento</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Mercado Pago (status)</dt>
              <dd className="text-gray-900">{pedido.mercadopago_status ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ID preferência</dt>
              <dd className="break-all font-mono text-xs text-gray-700">
                {pedido.mercadopago_preference_id ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">ID pagamento</dt>
              <dd className="break-all font-mono text-xs text-gray-700">
                {pedido.mercadopago_payment_id ?? "—"}
              </dd>
            </div>
          </dl>
          <PedidoMercadoPagoSyncButton pedidoId={pedido.id} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          {pedido.retirada_loja ? "Retirada na loja" : "Entrega"}
        </h2>
        {pedido.retirada_loja ? (
          <p className="mt-2 text-sm text-amber-900">
            Cliente optou por retirar no balcão — sem frete / sem postagem pelos Correios.
          </p>
        ) : null}
        <p className="mt-3 text-sm text-gray-700">
          {pedido.logradouro}, {pedido.numero}
          {pedido.complemento ? ` — ${pedido.complemento}` : ""}
          <br />
          {pedido.bairro} — {pedido.cidade}/{pedido.uf}
          <br />
          CEP {formatCep(pedido.cep)}
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">Subtotal</dt>
            <dd className="font-medium tabular-nums text-gray-900">{formatPedidoMoney(pedido.subtotal)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Frete</dt>
            <dd className="font-medium tabular-nums text-gray-900">{formatPedidoMoney(pedido.frete)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Total</dt>
            <dd className="font-semibold tabular-nums text-gray-900">{formatPedidoMoney(pedido.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Itens</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Produto</th>
                <th className="px-6 py-3">Código</th>
                <th className="px-6 py-3 text-right">Qtd.</th>
                <th className="px-6 py-3 text-right">Preço unit.</th>
                <th className="px-6 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedido.pedido_itens.map((item) => {
                const unit = Number(item.preco_unitario);
                const sub = Number.isFinite(unit) ? unit * item.quantidade : 0;
                return (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-gray-900">{item.titulo_snapshot}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">{item.cod_produto_snapshot}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-gray-900">{item.quantidade}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-gray-600">
                      {formatPedidoMoney(item.preco_unitario)}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums font-medium text-gray-900">
                      {formatPedidoMoney(sub)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Logística</h2>
        <p className="mt-1 text-sm text-gray-500">Rastreio e dados de envio exibidos ao cliente quando integrados.</p>
        <div className="mt-6">
          <MelhorEnvioSaldoPanel initial={meSaldo.data} initialError={meSaldo.error} />
          <PedidoLogisticaForm pedido={pedido} />
        </div>
      </section>
    </div>
  );
}
