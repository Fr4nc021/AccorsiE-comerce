"use client";

import { useActionState } from "react";
import { createMarca, type CreateMarcaState } from "@/features/marcas/services/marcaActions";

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

const initialState: CreateMarcaState = null;

export function MarcaForm() {
  const [state, formAction, pending] = useActionState(createMarca, initialState);

  return (
    <>
      {state && !state.ok && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm"
          role="alert"
        >
          <p className="font-semibold text-red-900">Não foi possível cadastrar</p>
          <p className="mt-1 text-sm leading-relaxed text-red-800/95">{state.message}</p>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome_marca" className="text-sm font-medium text-gray-700">
            Nome da marca
          </label>
          <input
            id="nome_marca"
            name="nome"
            required
            className={fieldClass}
            placeholder="Ex.: Honda, Fiat, Toyota"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1857d1] disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Cadastrar marca"}
        </button>
      </form>
    </>
  );
}
