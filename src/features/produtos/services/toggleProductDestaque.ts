"use server";

import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";

/** Alterna destaque a partir da listagem do painel (estrela). */
export async function toggleProductDestaque(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "");
  if (!id || (nextRaw !== "0" && nextRaw !== "1")) return;

  const supabase = await createClient();
  const { error } = await supabase.from("produtos").update({ em_destaque: nextRaw === "1" }).eq("id", id);

  if (error) {
    console.error("toggleProductDestaque:", error.message);
    return;
  }

  revalidatePath("/admin");
  revalidatePath("/");
}
