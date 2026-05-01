"use client";

import { useActionState } from "react";

import { atualizarPedidoLogisticaAction } from "@/features/pedidos-admin/services/atualizarPedidoLogistica";
import {
  comprarEnvioMelhorEnvioAction,
  gerarEtiquetaMelhorEnvioAction,
  imprimirDocumentosMelhorEnvioAction,
} from "@/features/pedidos-admin/services/melhorEnvioLogisticaActions";
import type { AdminPedidoDetailWithItens, PedidoLogisticaStatus } from "@/types/pedido";

const LOGISTICA_OPTIONS: { value: PedidoLogisticaStatus; label: string }[] = [
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "em_separacao", label: "Em separação" },
  { value: "postado", label: "Postado" },
  { value: "entregue", label: "Entregue" },
];

const FRETE_PROV_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Não definido" },
  { value: "fixo", label: "Fixo" },
  { value: "melhor_envio", label: "Melhor Envio" },
  { value: "manual", label: "Manual" },
];

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-[#1d63ed] focus:ring-2 focus:ring-[#1d63ed]/20";

export function PedidoLogisticaForm({ pedido }: { pedido: AdminPedidoDetailWithItens }) {
  const [state, formAction, isPending] = useActionState(atualizarPedidoLogisticaAction, null);
  const [buyState, buyAction, buyPending] = useActionState(comprarEnvioMelhorEnvioAction, null);
  const [labelState, labelAction, labelPending] = useActionState(gerarEtiquetaMelhorEnvioAction, null);
  const [printState, printAction, printPending] = useActionState(imprimirDocumentosMelhorEnvioAction, null);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="pedido_id" value={pedido.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-800">
            <input
              type="checkbox"
              name="retirada_loja"
              defaultChecked={pedido.retirada_loja === true}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1d63ed] focus:ring-[#1d63ed]"
            />
            <span>
              <span className="font-medium text-gray-900">Retirada na loja</span>
              <span className="mt-0.5 block text-xs text-gray-600">
                Marque se o cliente retira o pedido no balcão (sem envio pelos Correios). Isso atualiza o que o
                cliente vê no detalhe do pedido. Não altera valores já pagos (frete/total).
              </span>
            </span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="logistica_status">
            Status de logística
          </label>
          <select
            id="logistica_status"
            name="logistica_status"
            className={inputClass}
            defaultValue={pedido.logistica_status}
            required
          >
            {LOGISTICA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="transportadora_nome">
            Transportadora
          </label>
          <input
            id="transportadora_nome"
            name="transportadora_nome"
            type="text"
            className={inputClass}
            defaultValue={pedido.transportadora_nome ?? ""}
            placeholder="Ex.: Correios, Jadlog"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="frete_provedor">
            Origem do frete
          </label>
          <select
            id="frete_provedor"
            name="frete_provedor"
            className={inputClass}
            defaultValue={pedido.frete_provedor ?? ""}
          >
            {FRETE_PROV_OPTIONS.map((o) => (
              <option key={o.value || "empty"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="rastreio_codigo">
            Código de rastreio
          </label>
          <input
            id="rastreio_codigo"
            name="rastreio_codigo"
            type="text"
            className={inputClass}
            defaultValue={pedido.rastreio_codigo ?? ""}
            autoComplete="off"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="rastreio_url">
            URL de rastreio (opcional)
          </label>
          <input
            id="rastreio_url"
            name="rastreio_url"
            type="url"
            className={inputClass}
            defaultValue={pedido.rastreio_url ?? ""}
            placeholder="https://"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="melhor_envio_id">
            ID Melhor Envio
          </label>
          <input
            id="melhor_envio_id"
            name="melhor_envio_id"
            type="text"
            className={inputClass}
            defaultValue={pedido.melhor_envio_id ?? ""}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="melhor_envio_etiqueta_url">
            URL da etiqueta
          </label>
          <input
            id="melhor_envio_etiqueta_url"
            name="melhor_envio_etiqueta_url"
            type="url"
            className={inputClass}
            defaultValue={pedido.melhor_envio_etiqueta_url ?? ""}
            placeholder="https://"
          />
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Alterações salvas.
        </p>
      )}

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1857d1] disabled:opacity-60"
        >
          {isPending ? "Salvando…" : "Salvar logística"}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Ações Melhor Envio</h3>
        <p className="mt-1 text-xs text-gray-600">
          O checkout não cria envio no Melhor Envio: use o ID do carrinho/envio criado no painel Melhor Envio (ou API)
          e cole no campo &quot;ID Melhor Envio&quot;. As ações abaixo usam esse valor ao enviar o formulário e gravam
          no pedido se ainda não estiver salvo. A impressão pode retornar links de etiqueta e declaração de conteúdo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            formAction={buyAction}
            disabled={buyPending}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-gray-100 disabled:opacity-60"
          >
            {buyPending ? "Comprando..." : "Comprar envio"}
          </button>
          <button
            type="submit"
            formAction={labelAction}
            disabled={labelPending}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-gray-100 disabled:opacity-60"
          >
            {labelPending ? "Gerando..." : "Gerar etiqueta"}
          </button>
          <button
            type="submit"
            formAction={printAction}
            disabled={printPending}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-gray-100 disabled:opacity-60"
          >
            {printPending ? "Buscando..." : "Imprimir documentos"}
          </button>
        </div>
        {buyState?.error ? <p className="mt-2 text-xs text-red-700">{buyState.error}</p> : null}
        {buyState?.info ? <p className="mt-2 text-xs text-emerald-700">{buyState.info}</p> : null}
        {labelState?.error ? <p className="mt-2 text-xs text-red-700">{labelState.error}</p> : null}
        {labelState?.info ? <p className="mt-2 text-xs text-emerald-700">{labelState.info}</p> : null}
        {printState?.error ? <p className="mt-2 text-xs text-red-700">{printState.error}</p> : null}
        {printState?.info ? <p className="mt-2 text-xs text-emerald-700">{printState.info}</p> : null}
        {printState?.etiquetaUrl ? (
          <p className="mt-2 text-xs">
            <a
              href={printState.etiquetaUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-admin-accent hover:underline"
            >
              Abrir etiqueta
            </a>
          </p>
        ) : null}
        {printState?.declaracaoConteudoUrl ? (
          <p className="mt-2 text-xs">
            <a
              href={printState.declaracaoConteudoUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-admin-accent hover:underline"
            >
              Abrir declaração de conteúdo
            </a>
          </p>
        ) : null}
      </div>
    </form>
  );
}
