"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/services/supabase/server";
import { removeProductImageFromStorage } from "@/services/storage/removeProductImage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteKit(kitId: string): Promise<{ ok: false; message: string } | void> {
  await requireAdmin();
  const id = kitId.trim();
  if (!id) return { ok: false, message: "Kit inválido." };

  const supabase = await createClient();
  const { data: row } = await supabase.from("kits").select("imagem, slug").eq("id", id).maybeSingle();

  const { error } = await supabase.from("kits").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  if (row?.imagem) {
    await removeProductImageFromStorage(row.imagem);
  }

  revalidatePath("/");
  revalidatePath("/admin/kits");
  if (row?.slug) revalidatePath(`/kit/${row.slug}`);
  redirect("/admin/kits");
}
