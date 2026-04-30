import { createClient } from "@/services/supabase/server";
import { fetchProductIdsMatchingSearchTerm } from "@/features/produtos/services/productSearchMatchingIds";
import { resolveProductImagePublicUrl } from "@/features/produtos/utils/resolveProductImagePublicUrl";
import { clampPercent } from "@/features/produtos/utils/paymentDiscount";
import type { ProductSummary } from "@/types/product";

function intersectIds(a: string[], bSet: Set<string>): string[] {
  return a.filter((id) => bSet.has(id));
}

async function fetchCompatTodosModelosIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data, error } = await supabase.from("produtos").select("id").eq("compat_todos_modelos", true);
  if (error || !data?.length) return [];
  return data.map((r) => r.id as string).filter(Boolean);
}

type ProdutoRow = {
  id: string;
  titulo: string;
  cod_produto: string;
  valor: unknown;
  foto: string | null;
  quantidade_estoque: unknown;
  desconto_pix_percent?: unknown;
  desconto_cartao_percent?: unknown;
};

function mapRows(rows: ProdutoRow[]): ProductSummary[] {
  return rows.map((row) => ({
    id: row.id,
    titulo: row.titulo,
    cod_produto: row.cod_produto,
    valor: Number(row.valor),
    imageUrl: resolveProductImagePublicUrl(row.foto),
    quantidade_estoque: (() => {
      const q = Number(row.quantidade_estoque);
      return Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 0;
    })(),
    desconto_pix_percent: clampPercent(row.desconto_pix_percent),
    desconto_cartao_percent: clampPercent(row.desconto_cartao_percent),
  }));
}

export async function getHomeProducts(opts?: {
  q?: string | null;
  modeloId?: string | null;
  anoVeiculo?: number | null;
}): Promise<{
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

    const modeloId = opts?.modeloId?.trim() || null;
    let vehicleIds: string[] | null = null;
    if (modeloId) {
      let compQuery = supabase.from("produto_compatibilidades").select("produto_id").eq("modelo_id", modeloId);
      const ano = opts?.anoVeiculo;
      if (ano != null && Number.isFinite(ano)) {
        compQuery = compQuery.lte("ano_inicio", ano).gte("ano_fim", ano);
      }
      const { data: compRows, error: compErr } = await compQuery;
      if (compErr) return { destaque: [], vitrine: [] };
      const ids = new Set((compRows ?? []).map((r) => r.produto_id as string).filter(Boolean));
      const todosModelosIds = await fetchCompatTodosModelosIds(supabase);
      for (const pid of todosModelosIds) ids.add(pid);
      if (ids.size === 0) return { destaque: [], vitrine: [] };
      vehicleIds = [...ids];
    }

    let filterIds: string[] | null = null;
    if (searchIds && vehicleIds) {
      filterIds = intersectIds(searchIds, new Set(vehicleIds));
      if (filterIds.length === 0) return { destaque: [], vitrine: [] };
    } else if (searchIds) {
      filterIds = searchIds;
    } else if (vehicleIds) {
      filterIds = vehicleIds;
    }

    let destQuery = supabase
      .from("produtos")
      .select("id, titulo, cod_produto, valor, foto, quantidade_estoque, desconto_pix_percent, desconto_cartao_percent")
      .eq("em_destaque", true)
      .order("titulo")
      .limit(15);
    if (filterIds) destQuery = destQuery.in("id", filterIds);

    const destRes = await destQuery;
    const destaque = !destRes.error && destRes.data ? mapRows(destRes.data as ProdutoRow[]) : [];
    const destIds = destaque.map((p) => p.id);

    let vitQuery = supabase
      .from("produtos")
      .select("id, titulo, cod_produto, valor, foto, quantidade_estoque, desconto_pix_percent, desconto_cartao_percent")
      .order("titulo")
      .limit(10);
    if (filterIds) vitQuery = vitQuery.in("id", filterIds);
    if (destIds.length > 0) {
      vitQuery = vitQuery.not(
        "id",
        "in",
        `(${destIds.map((id) => `"${id}"`).join(",")})`,
      );
    }

    const prodRes = await vitQuery;

    return {
      destaque,
      vitrine: !prodRes.error && prodRes.data ? mapRows(prodRes.data as ProdutoRow[]) : [],
    };
  } catch {
    return { destaque: [], vitrine: [] };
  }
}
