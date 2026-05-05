"use client";

import { useActionState, useState } from "react";

import { createCupom, type CreateCupomState } from "@/features/cupons/services/cupomActions";

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

const initialState: CreateCupomState = null;

export function CupomForm() {
  const [state, formAction, pending] = useActionState(createCupom, initialState);
  const [tipo, setTipo] = useState<"percent" | "fixed">("percent");

  return (
    <>
      {state && !state.ok && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm" role="alert">
          <p className="font-semibold text-red-900">Não foi possível cadastrar</p>
          <p className="mt-1 text-sm leading-relaxed text-red-800/95">{state.message}</p>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cupom_codigo" className="text-sm font-medium text-gray-700">
            Código (palavra-chave)
          </label>
          <input
            id="cupom_codigo"
            name="codigo"
            required
            className={fieldClass}
            placeholder="Ex.: ACCORSI10"
            autoComplete="off"
          />
          <p className="text-xs text-gray-500">Será salvo em maiúsculas. O cliente digita no checkout.</p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-gray-700">Tipo de desconto</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
            <input
              type="radio"
              name="tipo"
              value="percent"
              checked={tipo === "percent"}
              onChange={() => setTipo("percent")}
              className="h-4 w-4 border-gray-300 text-admin-accent focus:ring-admin-accent"
            />
            Porcentagem sobre o total (produtos + frete)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
            <input
              type="radio"
              name="tipo"
              value="fixed"
              checked={tipo === "fixed"}
              onChange={() => setTipo("fixed")}
              className="h-4 w-4 border-gray-300 text-admin-accent focus:ring-admin-accent"
            />
            Valor fixo em reais (até o total do pedido)
          </label>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cupom_valor" className="text-sm font-medium text-gray-700">
            {tipo === "percent" ? "Percentual (%)" : "Valor (R$)"}
          </label>
          <input
            id="cupom_valor"
            name="valor"
            required
            inputMode="decimal"
            className={fieldClass}
            placeholder={tipo === "percent" ? "Ex.: 10" : "Ex.: 25,90"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cupom_valido_ate" className="text-sm font-medium text-gray-700">
            Válido até <span className="font-normal text-gray-500">(opcional)</span>
          </label>
          <input id="cupom_valido_ate" name="valido_ate" type="datetime-local" className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cupom_max_usos" className="text-sm font-medium text-gray-700">
            Máximo de usos <span className="font-normal text-gray-500">(opcional)</span>
          </label>
          <input
            id="cupom_max_usos"
            name="max_usos"
            type="number"
            min={1}
            inputMode="numeric"
            className={fieldClass}
            placeholder="Ilimitado se vazio"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" name="ativo" defaultChecked className="h-4 w-4 rounded border-gray-300" />
          Cupom ativo
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1857d1] disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Cadastrar cupom"}
        </button>
      </form>
    </>
  );
}
