"use client";

import { useActionState } from "react";
import { createCategoria, type CreateCategoriaState } from "@/features/categorias/services/categoriaActions";

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

const initialState: CreateCategoriaState = null;

export function CategoriaForm() {
  const [state, formAction, pending] = useActionState(createCategoria, initialState);

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
          <label htmlFor="nome_categoria" className="text-sm font-medium text-gray-700">
            Nome da categoria
          </label>
          <input
            id="nome_categoria"
            name="nome"
            required
            className={fieldClass}
            placeholder="Ex.: Freios, Filtros, Iluminação"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1857d1] disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Cadastrar categoria"}
        </button>
      </form>
    </>
  );
}
