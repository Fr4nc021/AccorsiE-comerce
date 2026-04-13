import type { SupabaseClient } from "@supabase/supabase-js";

/** Remove curingas perigosos do ILIKE e limita o tamanho. */
export function normalizeProductSearchInput(raw: string): string | null {
  const t = raw.trim().replace(/[%_]/g, "");
  if (t.length < 1) return null;
  return t.slice(0, 80);
}

/**
 * IDs de produtos cujo título/código contém o termo OU que tenham compatibilidade
 * com modelo ou marca de veículo cujo nome contém o termo (case insensitive).
 */
export async function fetchProductIdsMatchingSearchTerm(
  supabase: SupabaseClient,
  raw: string
): Promise<string[]> {
  const q = normalizeProductSearchInput(raw);
  if (!q) return [];

  const pattern = `%${q}%`;
  const ids = new Set<string>();

  const [byTitulo, byCod] = await Promise.all([
    supabase.from("produtos").select("id").ilike("titulo", pattern),
    supabase.from("produtos").select("id").ilike("cod_produto", pattern),
  ]);

  for (const row of byTitulo.data ?? []) {
    if (row.id) ids.add(row.id as string);
  }
  for (const row of byCod.data ?? []) {
    if (row.id) ids.add(row.id as string);
  }

  const { data: marcasRows } = await supabase.from("marcas").select("id").ilike("nome", pattern);
  const marcaIds = (marcasRows ?? []).map((r) => r.id as string);

  const modeloQueries = [supabase.from("modelos").select("id").ilike("nome", pattern)];
  if (marcaIds.length > 0) {
    modeloQueries.push(supabase.from("modelos").select("id").in("marca_id", marcaIds));
  }

  const modeloResults = await Promise.all(modeloQueries);
  const modeloIds = new Set<string>();
  for (const res of modeloResults) {
    for (const row of res.data ?? []) {
      if (row.id) modeloIds.add(row.id as string);
    }
  }

  if (modeloIds.size > 0) {
    const { data: comp } = await supabase
      .from("produto_compatibilidades")
      .select("produto_id")
      .in("modelo_id", [...modeloIds]);
    for (const row of comp ?? []) {
      if (row.produto_id) ids.add(row.produto_id as string);
    }
  }

  return [...ids];
}
