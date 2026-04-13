"use server";

import { createClient } from "@/services/supabase/server";
import { removeProductImageFromStorage } from "@/services/storage/removeProductImage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteProduct(productId: string): Promise<{ ok: false; message: string } | void> {
  const id = productId.trim();
  if (!id) {
    return { ok: false, message: "Produto inválido." };
  }

  const supabase = await createClient();

  const { data: row } = await supabase.from("produtos").select("foto").eq("id", id).maybeSingle();

  const { error: delComp } = await supabase
    .from("produto_compatibilidades")
    .delete()
    .eq("produto_id", id);

  if (delComp) {
    return { ok: false, message: delComp.message };
  }

  const { error } = await supabase.from("produtos").delete().eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (row?.foto) {
    await removeProductImageFromStorage(row.foto);
  }

  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath("/admin");
  revalidatePath("/admin/produtos/novo");
  redirect("/admin");
}
