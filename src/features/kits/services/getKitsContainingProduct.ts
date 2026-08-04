"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/services/supabase/server";

export async function getKitsContainingProduct(
  productId: string,
): Promise<Array<{ id: string; nome: string }>> {
  await requireAdmin();
  const id = productId.trim();
  if (!id) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kit_items")
    .select("kit_id, kits(id, nome)")
    .eq("product_id", id);

  if (error || !data) return [];

  const out: Array<{ id: string; nome: string }> = [];
  const seen = new Set<string>();
  for (const row of data) {
    const kitRaw = row.kits as unknown;
    const kit = Array.isArray(kitRaw) ? kitRaw[0] : kitRaw;
    if (!kit || typeof kit !== "object") continue;
    const k = kit as { id?: string; nome?: string | null };
    if (!k.id || seen.has(k.id)) continue;
    seen.add(k.id);
    out.push({ id: k.id, nome: (k.nome ?? "").trim() || "Kit sem nome" });
  }
  return out;
}
