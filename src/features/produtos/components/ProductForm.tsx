"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  ProductCompatibilidadeFieldset,
  type ModeloOption,
} from "@/features/produtos/components/ProductCompatibilidadeFieldset";
import {
  ProductCategoriasFieldset,
  type CategoriaOption,
} from "@/features/produtos/components/ProductCategoriasFieldset";
import { ProductDestaqueField } from "@/features/produtos/components/ProductDestaqueField";
import { ProductPhotoPanel } from "@/features/produtos/components/ProductPhotoPanel";
import { createProduct, type CreateProductState } from "@/features/produtos/services/createProduct";

export type { ModeloOption };
export type { CategoriaOption };

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

const initialState: CreateProductState | null = null;

export function ProductForm({
  modelos,
  categorias,
}: {
  modelos: ModeloOption[];
  categorias: CategoriaOption[];
}) {
  const [state, formAction, pending] = useActionState(createProduct, initialState);

  if (state?.ok) {
    return (
      <div
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 shadow-sm"
        role="status"
      >
        <p className="text-lg font-semibold text-emerald-900">Cadastro concluído</p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-800/95">{state.message}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1857d1]"
          >
            Ir ao painel
          </Link>
          <a
            href="/admin/produtos/novo"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cadastrar outro produto
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {state && !state.ok && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm"
          role="alert"
        >
          <p className="font-semibold text-red-900">Não foi possível cadastrar</p>
          <p className="mt-1 text-sm leading-relaxed text-red-800/95">{state.message}</p>
          <Link
            href="/admin"
            className="mt-4 inline-flex text-sm font-semibold text-admin-accent hover:underline"
          >
            Voltar ao painel
          </Link>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="titulo" className="text-sm font-medium text-gray-700">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            required
            className={fieldClass}
            placeholder="Ex.: Pastilha de freio dianteira"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cod_produto" className="text-sm font-medium text-gray-700">
            Código do produto
          </label>
          <input
            id="cod_produto"
            name="cod_produto"
            required
            className={fieldClass}
            placeholder="Ex.: ACC-001"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="descricao" className="text-sm font-medium text-gray-700">
            Descrição
          </label>
          <textarea
            id="descricao"
            name="descricao"
            rows={4}
            className={fieldClass}
            placeholder="Detalhes do produto"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="valor" className="text-sm font-medium text-gray-700">
              Valor (R$)
            </label>
            <input
              id="valor"
              name="valor"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              required
              className={fieldClass}
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quantidade_estoque" className="text-sm font-medium text-gray-700">
              Quantidade em estoque
            </label>
            <input
              id="quantidade_estoque"
              name="quantidade_estoque"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              defaultValue={0}
              className={fieldClass}
            />
          </div>
        </div>

        <ProductPhotoPanel />

        <ProductDestaqueField />

        <ProductCategoriasFieldset categorias={categorias} />

        <ProductCompatibilidadeFieldset modelos={modelos} />

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1857d1] disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Cadastrar produto"}
        </button>
      </form>
    </>
  );
}
