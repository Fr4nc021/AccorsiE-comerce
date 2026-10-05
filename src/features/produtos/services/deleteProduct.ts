"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/services/supabase/server";
import { removeProductImageIfUnused } from "@/services/storage/removeProductImage";
import { revalidatePath } from "next/cache";
import { revalidateStoreCatalogCache } from "@/features/produtos/utils/catalogCacheTags";
import { redirect } from "next/navigation";

type AdminSupabase = Awaited<ReturnType<typeof createClient>>;

function revalidateProductPaths() {
  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath("/admin");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/admin/kits");
  revalidateStoreCatalogCache();
}

async function deleteOneProduct(
  supabase: AdminSupabase,
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
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
    await removeProductImageIfUnused(row.foto);
  }

  return { ok: true };
}

export async function deleteProduct(productId: string): Promise<{ ok: false; message: string } | void> {
  await requireAdmin();
  const id = productId.trim();
  if (!id) {
    return { ok: false, message: "Produto inválido." };
  }

  const supabase = await createClient();
  const result = await deleteOneProduct(supabase, id);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateProductPaths();
  redirect("/admin");
}

export type DeleteProductsEmLoteResult = {
  removidos: number;
  falhas: { id: string; message: string }[];
};

/** Exclui vários produtos em sequência; falhas são retornadas sem interromper os demais. */
export async function deleteProductsEmLote(ids: string[]): Promise<DeleteProductsEmLoteResult> {
  await requireAdmin();
  const unique = [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
  const falhas: { id: string; message: string }[] = [];
  let removidos = 0;

  if (unique.length === 0) {
    return { removidos: 0, falhas: [] };
  }

  const supabase = await createClient();
  for (const id of unique) {
    const result = await deleteOneProduct(supabase, id);
    if (!result.ok) {
      falhas.push({ id, message: result.message });
    } else {
      removidos += 1;
    }
  }

  if (removidos > 0) {
    revalidateProductPaths();
  }

  return { removidos, falhas };
}
