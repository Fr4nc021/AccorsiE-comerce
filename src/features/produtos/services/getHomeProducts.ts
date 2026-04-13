import { createClient } from "@/services/supabase/server";
import { fetchProductIdsMatchingSearchTerm } from "@/features/produtos/services/productSearchMatchingIds";
import { resolveProductImagePublicUrl } from "@/features/produtos/utils/resolveProductImagePublicUrl";
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

export async function getHomeProducts(opts?: { q?: string | null }): Promise<{
  destaque: ProductSummary[];
  vitrine: ProductSummary[];
}> {
  try {
    const supabase = await createClient();
    const rawSearch = opts?.q?.trim();
    let searchIds: string[] | null = null;
    if (rawSearch) {
      const ids = await fetchProductIdsMatchingSearchTerm(supabase, rawSearch);
      if (ids.length === 0) return { destaque: [], vitrine: [] };
      searchIds = ids;
    }

    let destQuery = supabase
      .from("produtos")
      .select("id, titulo, cod_produto, valor, foto")
      .eq("em_destaque", true)
      .order("titulo")
      .limit(15);
    let vitQuery = supabase
      .from("produtos")
      .select("id, titulo, cod_produto, valor, foto")
      .eq("em_destaque", false)
      .order("titulo")
      .limit(40);
    if (searchIds) {
      destQuery = destQuery.in("id", searchIds);
      vitQuery = vitQuery.in("id", searchIds);
    }

    const [destRes, prodRes] = await Promise.all([destQuery, vitQuery]);

    return {
      destaque: !destRes.error && destRes.data ? mapRows(destRes.data as ProdutoRow[]) : [],
      vitrine: !prodRes.error && prodRes.data ? mapRows(prodRes.data as ProdutoRow[]) : [],
    };
  } catch {
    return { destaque: [], vitrine: [] };
  }
}
