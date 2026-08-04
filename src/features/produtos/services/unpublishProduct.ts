"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { PRODUCT_STATUS_DRAFT } from "@/features/produtos/utils/productStatus";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";

export type UnpublishProductState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function unpublishProduct(productId: string): Promise<UnpublishProductState> {
  await requireAdmin();
  const id = productId.trim();
  if (!id) return { ok: false, message: "Produto não identificado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("produtos")
    .update({ status: PRODUCT_STATUS_DRAFT })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${id}/edit`);

  return { ok: true, message: "Produto despublicado. Ele não aparece mais no site." };
}
