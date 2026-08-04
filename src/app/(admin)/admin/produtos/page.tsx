import Link from "next/link";
import { Suspense } from "react";

import { AdminDashboardProductSearch } from "@/features/admin/components/AdminDashboardProductSearch";
import { AdminCatalogTabs } from "@/features/kits/components/AdminCatalogTabs";
import { ProductDestaqueStarForm } from "@/features/produtos/components/ProductDestaqueStarForm";
import { ProductRowActions } from "@/features/produtos/components/ProductRowActions";
import { ProductCreateButton } from "@/features/produtos/components/ProductCreateButton";
import { ProductStatusBadge } from "@/features/produtos/components/ProductStatusBadge";
import { normalizeProductSearchInput } from "@/features/produtos/services/productSearchMatchingIds";
import {
  parseProductStatus,
  type ProductStatus,
} from "@/features/produtos/utils/productStatus";
import { createClient } from "@/services/supabase/server";

export const metadata = {
  title: "Produtos | Admin",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ProdutoRow = {
  id: string;
  titulo: string | null;
  cod_produto: string | null;
  valor: number | null;
  quantidade_estoque: number;
  em_destaque: boolean;
  status: ProductStatus;
};

type KpiRow = { valor: number; quantidade_estoque: number };

const PRODUTO_LIST_SELECT =
  "id, titulo, cod_produto, valor, quantidade_estoque, em_destaque, status" as const;

type StatusFilter = "all" | ProductStatus;

function parseStatusFilter(raw: string | undefined): StatusFilter {
  if (raw === "draft" || raw === "published") return raw;
  return "all";
}

function mergeProdutosById(a: ProdutoRow[], b: ProdutoRow[]): ProdutoRow[] {
  const map = new Map<string, ProdutoRow>();
  for (const row of a) map.set(row.id, row);
  for (const row of b) map.set(row.id, row);
  return [...map.values()].sort((x, y) =>
    (x.titulo ?? "").localeCompare(y.titulo ?? "", "pt-BR", { sensitivity: "base" })
  );
}

function computeKpiStats(rows: KpiRow[]) {
  const n = rows.length;
  const totalItens = rows.reduce((s, p) => s + Number(p.quantidade_estoque), 0);
  const valorEstoque = rows.reduce(
    (s, p) => s + Number(p.valor) * Number(p.quantidade_estoque),
    0
  );
  const esgotados = rows.filter((p) => Number(p.quantidade_estoque) <= 0).length;
  const ultimaUnidade = rows.filter((p) => Number(p.quantidade_estoque) === 1).length;
  return { n, totalItens, valorEstoque, esgotados, ultimaUnidade };
}

function statusFilterHref(status: StatusFilter, q: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  return qs ? `/admin/produtos?${qs}` : "/admin/produtos";
}

export default async function AdminProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[]; erro?: string | string[] }>;
}) {
  let produtos: ProdutoRow[] = [];
  let loadError: string | null = null;

  const sp = await searchParams;
  const rawQ = typeof sp.q === "string" ? sp.q : Array.isArray(sp.q) ? sp.q[0] : "";
  const searchTerm = normalizeProductSearchInput(rawQ);
  const rawStatus =
    typeof sp.status === "string" ? sp.status : Array.isArray(sp.status) ? sp.status[0] : "";
  const statusFilter = parseStatusFilter(rawStatus);
  const rawErro = typeof sp.erro === "string" ? sp.erro : Array.isArray(sp.erro) ? sp.erro[0] : "";

  let kpiRows: KpiRow[] = [];

  try {
    const supabase = await createClient();
    const mapProdutoRows = (rows: unknown): ProdutoRow[] =>
      (rows as Array<Omit<ProdutoRow, "status" | "em_destaque"> & { status?: unknown; em_destaque?: unknown }>).map(
        (row) => ({
          ...row,
          em_destaque: Boolean(row.em_destaque),
          status: parseProductStatus(row.status),
        })
      );

    const applyStatus = <T extends { eq: (col: string, val: string) => T }>(query: T): T => {
      if (statusFilter === "all") return query;
      return query.eq("status", statusFilter);
    };

    if (!searchTerm) {
      let query = supabase.from("produtos").select(PRODUTO_LIST_SELECT).order("titulo");
      query = applyStatus(query);
      const { data, error } = await query;

      if (error) {
        loadError = error.message;
      } else if (data) {
        produtos = mapProdutoRows(data);
        kpiRows = produtos.map((p) => ({
          valor: Number(p.valor ?? 0),
          quantidade_estoque: Number(p.quantidade_estoque),
        }));
      }
    } else {
      const pattern = `%${searchTerm}%`;
      let kpiQuery = supabase.from("produtos").select("valor, quantidade_estoque");
      kpiQuery = applyStatus(kpiQuery);
      let tituloQuery = supabase.from("produtos").select(PRODUTO_LIST_SELECT).ilike("titulo", pattern);
      tituloQuery = applyStatus(tituloQuery);
      let codQuery = supabase.from("produtos").select(PRODUTO_LIST_SELECT).ilike("cod_produto", pattern);
      codQuery = applyStatus(codQuery);

      const [kpiRes, tituloRes, codRes] = await Promise.all([kpiQuery, tituloQuery, codQuery]);

      const err =
        kpiRes.error?.message ?? tituloRes.error?.message ?? codRes.error?.message ?? null;
      if (err) {
        loadError = err;
      } else {
        kpiRows = (kpiRes.data ?? []) as KpiRow[];
        produtos = mergeProdutosById(
          mapProdutoRows(tituloRes.data ?? []),
          mapProdutoRows(codRes.data ?? [])
        );
      }
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Erro ao carregar produtos.";
  }

  const { n, totalItens, valorEstoque, esgotados, ultimaUnidade } = computeKpiStats(kpiRows);

  const filterChips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "draft", label: "Em cadastro" },
    { key: "published", label: "Publicados" },
  ];

  return (
    <div className="space-y-6">
      <AdminCatalogTabs active="produtos" />

      {rawErro && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
          role="alert"
        >
          <p className="font-semibold">Não foi possível criar o produto</p>
          <p className="mt-1">{rawErro}</p>
        </div>
      )}

      {loadError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
          role="alert"
        >
          <p className="font-semibold">Erro ao carregar</p>
          <p className="mt-1">{loadError}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Produtos</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{n}</p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Itens em estoque</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            {totalItens.toLocaleString("pt-BR")}
          </p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Valor em estoque</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{money.format(valorEstoque)}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 shrink">
            <h2 className="text-base font-semibold text-gray-900">Lista de produtos</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {searchTerm
                ? `Filtrando por nome ou código · ${produtos.length} resultado${produtos.length === 1 ? "" : "s"}`
                : "Pesquise, edite e gerencie o catálogo"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {filterChips.map((chip) => {
                const active = statusFilter === chip.key;
                return (
                  <Link
                    key={chip.key}
                    href={statusFilterHref(chip.key, searchTerm ?? "")}
                    className={
                      active
                        ? "rounded-full bg-admin-accent px-3 py-1 text-xs font-semibold text-white"
                        : "rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                    }
                  >
                    {chip.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
            <Suspense
              fallback={
                <div
                  className="h-10 w-full max-w-md shrink-0 animate-pulse rounded-lg bg-gray-100 lg:mt-0.5"
                  aria-hidden
                />
              }
            >
              <AdminDashboardProductSearch />
            </Suspense>
            <ProductCreateButton />
          </div>
        </div>

        {ultimaUnidade > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-950" role="status">
            <p className="font-semibold">Atenção: última unidade em estoque</p>
            <p className="mt-1 text-amber-900/95">
              {ultimaUnidade === 1
                ? "Há 1 produto com apenas uma unidade disponível. Reposição recomendada."
                : `Há ${ultimaUnidade} produtos com apenas uma unidade disponível. Reposição recomendada.`}
            </p>
          </div>
        )}
        {esgotados > 0 && (
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-700">
            {esgotados} produto{esgotados > 1 ? "s" : ""} sem estoque.
          </div>
        )}

        {produtos.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">
            {searchTerm || statusFilter !== "all"
              ? "Nenhum produto encontrado para esse filtro."
              : "Nenhum produto cadastrado ainda."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="w-14 px-2 py-3 text-center text-amber-500" scope="col">
                    <span className="sr-only">Destaque na home</span>
                    <span aria-hidden>★</span>
                  </th>
                  <th className="px-6 py-3">Produto</th>
                  <th className="px-6 py-3">Código</th>
                  <th className="px-6 py-3 text-right">Valor</th>
                  <th className="px-6 py-3 text-right">Estoque</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {produtos.map((p) => {
                  const q = Number(p.quantidade_estoque);
                  return (
                    <tr key={p.id} className="text-gray-900 transition hover:bg-gray-50/80">
                      <td className="px-2 py-4">
                        <ProductDestaqueStarForm productId={p.id} emDestaque={p.em_destaque} />
                      </td>
                      <td className="px-6 py-4 font-medium">{p.titulo?.trim() || "Sem título"}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {p.cod_produto?.trim() || "—"}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums font-medium">
                        {p.valor != null ? money.format(Number(p.valor)) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-gray-700">{q}</td>
                      <td className="px-6 py-4 text-center">
                        <ProductStatusBadge status={p.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ProductRowActions productId={p.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
