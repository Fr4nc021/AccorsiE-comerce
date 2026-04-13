"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { StoreMarcaOption } from "@/features/marcas/services/getStoreMarcas";
import {
  buildCatalogQueryString,
  parseCatalogSearchParamsFromUrlSearchParams,
} from "@/features/produtos/utils/catalogSearchParams";
import type { CatalogFilters } from "@/features/produtos/utils/catalogSearchParams";
import type { CategoryListItem } from "@/types/category";

type ProductCatalogFiltersProps = {
  categorias: CategoryListItem[];
  marcas: StoreMarcaOption[];
  sliderMax: number;
};

function IconFunnel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h16l-6 7v6l-4 2v-8L4 5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProductCatalogFilters({ categorias, marcas, sliderMax }: ProductCatalogFiltersProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [localMin, setLocalMin] = useState(0);
  const [localMax, setLocalMax] = useState(sliderMax);

  useEffect(() => {
    const f = parseCatalogSearchParamsFromUrlSearchParams(sp);
    setLocalMin(f.precoMin != null && f.precoMin > 0 ? f.precoMin : 0);
    setLocalMax(f.precoMax != null && f.precoMax < sliderMax ? f.precoMax : sliderMax);
  }, [sp, sliderMax]);

  const replaceFilters = (next: CatalogFilters) => {
    const qs = buildCatalogQueryString(next, sliderMax);
    router.replace(`/produtos${qs}`, { scroll: false });
  };

  const toggleCategoria = (id: string) => {
    const f = parseCatalogSearchParamsFromUrlSearchParams(sp);
    const set = new Set(f.categoriaIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    replaceFilters({ ...f, categoriaIds: [...set] });
  };

  const toggleMarca = (id: string) => {
    const f = parseCatalogSearchParamsFromUrlSearchParams(sp);
    const set = new Set(f.marcaIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    replaceFilters({ ...f, marcaIds: [...set] });
  };

  const aplicarPreco = () => {
    const f = parseCatalogSearchParamsFromUrlSearchParams(sp);
    replaceFilters({ ...f, precoMin: localMin, precoMax: localMax });
  };

  const limpar = () => {
    router.replace("/produtos", { scroll: false });
  };

  const f = parseCatalogSearchParamsFromUrlSearchParams(sp);
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const checkClass =
    "flex cursor-pointer items-start gap-2.5 rounded-md py-1.5 text-sm text-store-navy hover:bg-store-subtle/80";

  return (
    <div className="rounded-sm border border-store-line/80 bg-white p-5 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-store-navy">
        <IconFunnel className="h-5 w-5 shrink-0 text-store-accent" />
        Filtros
      </h2>

      <div className="flex flex-col gap-8">
        <fieldset className="min-w-0">
          <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-store-navy-muted">
            Categoria
          </legend>
          {categorias.length === 0 ? (
            <p className="text-sm text-store-navy-muted">Nenhuma categoria cadastrada.</p>
          ) : (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
              {categorias.map((c) => (
                <li key={c.id}>
                  <label className={checkClass}>
                    <input
                      type="checkbox"
                      checked={f.categoriaIds.includes(c.id)}
                      onChange={() => toggleCategoria(c.id)}
                      className="mt-0.5 size-4 shrink-0 rounded border-store-line text-store-navy focus:ring-store-navy/30"
                    />
                    <span>{c.nome}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-store-navy-muted">Marca</legend>
          {marcas.length === 0 ? (
            <p className="text-sm text-store-navy-muted">Nenhuma marca cadastrada.</p>
          ) : (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
              {marcas.map((m) => (
                <li key={m.id}>
                  <label className={checkClass}>
                    <input
                      type="checkbox"
                      checked={f.marcaIds.includes(m.id)}
                      onChange={() => toggleMarca(m.id)}
                      className="mt-0.5 size-4 shrink-0 rounded border-store-line text-store-navy focus:ring-store-navy/30"
                    />
                    <span>{m.nome}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-store-navy-muted">
            Faixa de preço
          </legend>
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-store-navy">
              <span className="mb-1.5 block text-store-navy-muted">Mínimo</span>
              <input
                type="range"
                min={0}
                max={Math.min(sliderMax, localMax)}
                value={Math.min(localMin, localMax)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLocalMin(Math.min(v, localMax));
                }}
                className="w-full cursor-pointer accent-store-accent"
              />
              <span className="mt-1 block text-sm text-store-navy">{money.format(localMin)}</span>
            </label>
            <label className="block text-xs font-semibold text-store-navy">
              <span className="mb-1.5 block text-store-navy-muted">Máximo</span>
              <input
                type="range"
                min={Math.max(0, localMin)}
                max={sliderMax}
                value={Math.max(localMin, localMax)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLocalMax(Math.max(v, localMin));
                }}
                className="w-full cursor-pointer accent-store-accent"
              />
              <span className="mt-1 block text-sm text-store-navy">{money.format(localMax)}</span>
            </label>
            <div className="flex justify-between text-[0.7rem] font-medium text-store-navy-muted">
              <span>{money.format(0)}</span>
              <span>até {money.format(sliderMax)}</span>
            </div>
            <button
              type="button"
              onClick={aplicarPreco}
              className="w-full rounded-sm bg-store-navy px-3 py-2 text-sm font-bold text-white transition hover:brightness-110"
            >
              Aplicar faixa de preço
            </button>
          </div>
        </fieldset>

        <button
          type="button"
          onClick={limpar}
          className="text-sm font-semibold text-store-navy-muted underline decoration-store-line underline-offset-4 hover:text-store-accent"
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
