import Link from "next/link";

import { listPedidosAdmin } from "@/features/pedidos-admin/services/listPedidosAdmin";
import {
  formatPedidoDate,
  formatPedidoMoney,
  formatPedidoStatus,
} from "@/features/pedidos/utils/pedidoDisplay";
import type { AdminPedidoListRow, PedidoLogisticaStatus } from "@/types/pedido";

export const metadata = {
  title: "Pedidos | Admin",
};

const logisticaLabel: Record<PedidoLogisticaStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_separacao: "Em separação",
  postado: "Postado",
  entregue: "Entregue",
};

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function logisticaPillClass(ls: PedidoLogisticaStatus): string {
  switch (ls) {
    case "entregue":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "postado":
      return "bg-sky-50 text-sky-900 ring-sky-200";
    case "em_separacao":
      return "bg-amber-50 text-amber-950 ring-amber-200";
    default:
      return "bg-gray-100 text-gray-700 ring-gray-200";
  }
}

function pagamentoPillClass(status: AdminPedidoListRow["status"]): string {
  if (status === "pago") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "aguardando_pagamento") return "bg-amber-50 text-amber-950 ring-amber-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

export default async function AdminPedidosPage() {
  let pedidos: AdminPedidoListRow[] = [];
  let fatalMessage: string | null = null;
  let isConfig = false;

  try {
    pedidos = await listPedidosAdmin();
  } catch (e) {
    fatalMessage = e instanceof Error ? e.message : "Erro ao carregar pedidos.";
    isConfig =
      fatalMessage.includes("SUPABASE_SERVICE_ROLE_KEY") ||
      fatalMessage.includes("NEXT_PUBLIC_SUPABASE_URL");
  }

  const totalPedidos = pedidos.length;
  const pedidosPagos = pedidos.filter((p) => p.status === "pago").length;
  const emSeparacao = pedidos.filter((p) => p.logistica_status === "em_separacao").length;
  const totalFaturado = pedidos
    .filter((p) => p.status === "pago")
    .reduce((acc, pedido) => acc + toSafeNumber(pedido.total), 0);

  return (
    <div className="space-y-6">
      {fatalMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
            isConfig
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-red-200 bg-red-50 text-red-950"
          }`}
          role="alert"
        >
          <p className="font-semibold">{isConfig ? "Configuração" : "Erro ao carregar"}</p>
          <p className={isConfig ? "mt-1 text-amber-900/90" : "mt-1"}>{fatalMessage}</p>
          {isConfig && (
            <p className="mt-2 text-xs text-amber-800/80">
              Defina <code className="rounded bg-black/5 px-1">SUPABASE_SERVICE_ROLE_KEY</code> no ambiente do
              servidor (junto com a URL do projeto) para o painel acessar pedidos.
            </p>
          )}
        </div>
      )}

      {!fatalMessage && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total de pedidos</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{totalPedidos}</p>
            </article>
            <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pagos</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">{pedidosPagos}</p>
            </article>
            <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Em separação</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">{emSeparacao}</p>
            </article>
            <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Faturado</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{formatPedidoMoney(totalFaturado)}</p>
            </article>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Pedidos</h2>
              <p className="mt-0.5 text-sm text-gray-500">Todos os pedidos da loja</p>
            </div>

            {pedidos.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-gray-500">Nenhum pedido ainda.</p>
            ) : (
              <>
                <div className="divide-y divide-gray-100 md:hidden">
                  {pedidos.map((p) => (
                    <article key={p.id} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-500">{formatPedidoDate(p.created_at)}</p>
                          <p className="mt-1 font-medium text-gray-900">{p.destinatario_nome}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-gray-900">
                          {formatPedidoMoney(p.total)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${pagamentoPillClass(
                            p.status,
                          )}`}
                        >
                          {formatPedidoStatus(p.status)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${logisticaPillClass(p.logistica_status)}`}
                        >
                          {logisticaLabel[p.logistica_status]}
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-gray-600">
                        Rastreio: {p.rastreio_codigo ?? "—"}
                      </p>
                      <Link
                        href={`/admin/pedidos/${p.id}`}
                        className="inline-flex rounded-lg bg-admin-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1857d1]"
                      >
                        Abrir pedido
                      </Link>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-6 py-3">Data</th>
                        <th className="px-6 py-3">Cliente (entrega)</th>
                        <th className="px-6 py-3">Pagamento</th>
                        <th className="px-6 py-3">Logística</th>
                        <th className="px-6 py-3">Rastreio</th>
                        <th className="px-6 py-3 text-right">Total</th>
                        <th className="px-6 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pedidos.map((p) => (
                        <tr key={p.id} className="text-gray-900 transition hover:bg-gray-50/80">
                          <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                            {formatPedidoDate(p.created_at)}
                          </td>
                          <td className="max-w-[200px] px-6 py-4">
                            <span className="font-medium text-gray-900">{p.destinatario_nome}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${pagamentoPillClass(
                                p.status,
                              )}`}
                            >
                              {formatPedidoStatus(p.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${logisticaPillClass(
                                p.logistica_status,
                              )}`}
                            >
                              {logisticaLabel[p.logistica_status]}
                            </span>
                          </td>
                          <td className="max-w-[140px] truncate px-6 py-4 font-mono text-xs text-gray-600">
                            {p.rastreio_codigo ?? "—"}
                          </td>
                          <td className="px-6 py-4 text-right tabular-nums font-medium">
                            {formatPedidoMoney(p.total)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/admin/pedidos/${p.id}`}
                              className="font-medium text-admin-accent hover:underline"
                            >
                              Abrir
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
