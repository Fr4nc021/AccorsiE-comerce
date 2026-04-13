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
import { updateProduct, type UpdateProductState } from "@/features/produtos/services/updateProduct";

export type { ModeloOption, CategoriaOption };

export type ProductCompatRow = {
  modelo_id: string;
  ano_inicio: string;
  ano_fim: string;
};

export type ProductEditValues = {
  id: string;
  titulo: string;
  cod_produto: string;
  descricao: string;
  valor: number;
  foto: string;
  quantidade_estoque: number;
  em_destaque: boolean;
  categoria_ids: string[];
  compat_rows: ProductCompatRow[];
};

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

const initialState: UpdateProductState | null = null;

export function ProductEditForm({
  product,
  modelos,
  categorias,
}: {
  product: ProductEditValues;
  modelos: ModeloOption[];
  categorias: CategoriaOption[];
}) {
  const [state, formAction, pending] = useActionState(updateProduct, initialState);

  return (
    <>
      {state?.ok && (
        <div
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm"
          role="status"
        >
          <p className="font-semibold text-emerald-900">Alterações salvas</p>
          <p className="mt-1 text-sm text-emerald-800/95">{state.message}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-lg bg-admin-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1857d1]"
            >
              Ir ao painel
            </Link>
            <a
              href={`/admin/produtos/${product.id}/edit`}
              className="inline-flex items-center justify-center text-sm font-semibold text-admin-accent underline-offset-4 hover:underline"
            >
              Continuar editando
            </a>
          </div>
        </div>
      )}

      {state && !state.ok && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm" role="alert">
          <p className="font-semibold text-red-900">Algo deu errado</p>
          <p className="mt-1 text-sm text-red-800/95">{state.message}</p>
          <Link
            href="/admin"
            className="mt-3 inline-block text-sm font-semibold text-admin-accent hover:underline"
          >
            Voltar ao painel
          </Link>
        </div>
      )}

      {state?.ok ? null : (
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={product.id} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="titulo" className="text-sm font-medium text-gray-700">
              Título
            </label>
            <input
              id="titulo"
              name="titulo"
              required
              defaultValue={product.titulo}
              className={fieldClass}
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
              defaultValue={product.cod_produto}
              className={fieldClass}
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
              defaultValue={product.descricao}
              className={fieldClass}
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
                defaultValue={product.valor}
                className={fieldClass}
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
                defaultValue={product.quantidade_estoque}
                className={fieldClass}
              />
            </div>
          </div>

          <ProductPhotoPanel initialFoto={product.foto} />

          <ProductDestaqueField key={product.id} defaultChecked={product.em_destaque} />

          <ProductCategoriasFieldset categorias={categorias} selectedIds={product.categoria_ids} />

          <ProductCompatibilidadeFieldset
            modelos={modelos}
            initialRows={product.compat_rows}
            replaceOnSave
          />

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1857d1] disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Salvar alterações"}
          </button>
        </form>
      )}
    </>
  );
}
