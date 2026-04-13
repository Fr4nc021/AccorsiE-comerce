import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** IDs de categorias marcados no formulário (`name="categoria_ids"`). */
export function parseCategoriaIdsFromFormData(formData: FormData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of formData.getAll("categoria_ids")) {
    const s = String(v).trim();
    if (!s || seen.has(s)) continue;
    if (!UUID_RE.test(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Mantém apenas IDs que existem em `categorias` (ordem preservada). */
export async function fetchValidCategoriaIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("categorias").select("id").in("id", ids);
  if (error || !data) return [];
  const allowed = new Set(ids);
  return (data as { id: string }[]).map((r) => r.id).filter((id) => allowed.has(id));
}
