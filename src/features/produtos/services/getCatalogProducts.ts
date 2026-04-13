import { createClient } from "@/services/supabase/server";
import { resolveProductImagePublicUrl } from "@/features/produtos/utils/resolveProductImagePublicUrl";
import { fetchProductIdsMatchingSearchTerm } from "@/features/produtos/services/productSearchMatchingIds";
import type { CatalogFilters } from "@/features/produtos/utils/catalogSearchParams";
import type { ProductSummary } from "@/types/product";

type ProdutoRow = {
  id: string;
  titulo: string;
  cod_produto: string;
  valor: unknown;
  foto: string | null;
};

function mapRows(rows: ProdutoRow[]): ProductSummary[] {
  return rows.map((row) => ({
    id: row.id,
    titulo: row.titulo,
    cod_produto: row.cod_produto,
    valor: Number(row.valor),
    imageUrl: resolveProductImagePublicUrl(row.foto),
  }));
}

function intersect(a: string[], bSet: Set<string>): string[] {
  return a.filter((id) => bSet.has(id));
}

/** Teto da faixa de preço (slider), em reais, com valor mínimo útil quando não há produtos. */
export async function getCatalogSliderMax(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("produtos")
      .select("valor")
      .order("valor", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || data == null || data.valor == null) return 1000;
    const v = Number(data.valor);
    if (!Number.isFinite(v) || v <= 0) return 1000;
    return Math.max(100, Math.ceil(v / 50) * 50);
  } catch {
    return 1000;
  }
}

/**
 * Lista produtos do catálogo com filtros opcionais.
 * Marca usa `marcas` + `modelos` + `produto_compatibilidades` (marca do veículo compatível).
 */
export async function getCatalogProducts(
  filters: CatalogFilters,
  sliderMax: number
): Promise<ProductSummary[]> {
  try {
    const supabase = await createClient();
    let candidateIds: string[] | undefined;

    if (filters.categoriaIds.length > 0) {
      const { data, error } = await supabase
        .from("produto_categorias")
        .select("produto_id")
        .in("categoria_id", filters.categoriaIds);
      if (error || !data?.length) return [];
      const set = new Set(data.map((r) => r.produto_id as string));
      candidateIds = [...set];
    }

    if (filters.marcaIds.length > 0) {
      const { data: modelosRows, error: modErr } = await supabase
        .from("modelos")
        .select("id")
        .in("marca_id", filters.marcaIds);
      if (modErr || !modelosRows?.length) return [];
      const modeloIds = modelosRows.map((r) => r.id as string);
      const { data: compRows, error: compErr } = await supabase
        .from("produto_compatibilidades")
        .select("produto_id")
        .in("modelo_id", modeloIds);
      if (compErr || !compRows?.length) return [];
      const marcaSet = new Set(compRows.map((r) => r.produto_id as string));
      if (candidateIds) {
        candidateIds = intersect(candidateIds, marcaSet);
        if (candidateIds.length === 0) return [];
      } else {
        candidateIds = [...marcaSet];
      }
    }

    const rawSearch = filters.q?.trim();
    if (rawSearch) {
      const searchIds = await fetchProductIdsMatchingSearchTerm(supabase, rawSearch);
      if (searchIds.length === 0) return [];
      const searchSet = new Set(searchIds);
      if (candidateIds) {
        candidateIds = intersect(candidateIds, searchSet);
        if (candidateIds.length === 0) return [];
      } else {
        candidateIds = [...searchSet];
      }
    }

    let produtosQuery = supabase.from("produtos").select("id, titulo, cod_produto, valor, foto").order("titulo");
    if (candidateIds) produtosQuery = produtosQuery.in("id", candidateIds);
    if (filters.precoMin != null && filters.precoMin > 0) produtosQuery = produtosQuery.gte("valor", filters.precoMin);
    if (filters.precoMax != null && filters.precoMax < sliderMax) {
      produtosQuery = produtosQuery.lte("valor", filters.precoMax);
    }

    const { data, error } = await produtosQuery;
    if (error || !data) return [];
    return mapRows(data as ProdutoRow[]);
  } catch {
    return [];
  }
}
