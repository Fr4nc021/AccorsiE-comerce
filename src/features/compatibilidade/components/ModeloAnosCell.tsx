"use client";

import { useActionState } from "react";
import { addModeloAno, removeModeloAno, type ModeloAnoState } from "@/features/compatibilidade/services/modeloActions";

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

const initialState: ModeloAnoState = null;

export function ModeloAnosCell({
  modeloId,
  anos,
}: {
  modeloId: string;
  anos: { id: string; ano: number }[];
}) {
  const [state, formAction, pending] = useActionState(addModeloAno, initialState);

  return (
    <div className="max-w-md space-y-2">
      {state && !state.ok && (
        <p className="text-xs text-red-700" role="alert">
          {state.message}
        </p>
      )}
      {anos.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {anos.map((row) => (
            <li
              key={row.id}
              className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-800"
            >
              <span>{row.ano}</span>
              <form action={removeModeloAno} className="inline leading-none">
                <input type="hidden" name="id" value={row.id} />
                <button
                  type="submit"
                  className="ml-0.5 rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                  aria-label={`Remover ano ${row.ano}`}
                  title="Remover"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">Nenhum ano de referência ainda.</p>
      )}
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="modelo_id" value={modeloId} />
        <div className="flex flex-col gap-0.5">
          <label className="sr-only" htmlFor={`ano-${modeloId}`}>
            Ano
          </label>
          <input
            id={`ano-${modeloId}`}
            name="ano"
            type="number"
            min={1900}
            max={2100}
            placeholder="Ex.: 2015"
            className={`${fieldClass} w-[6.5rem]`}
            disabled={pending}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
        >
          {pending ? "…" : "Adicionar ano"}
        </button>
      </form>
      <p className="text-[11px] leading-snug text-gray-400">
        Referência para conferência; na compatibilidade do produto use início/fim como hoje.
      </p>
    </div>
  );
}
