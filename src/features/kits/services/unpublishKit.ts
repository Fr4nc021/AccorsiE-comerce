"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { KIT_STATUS_DRAFT } from "@/features/kits/utils/kitStatus";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";

export type UnpublishKitState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function unpublishKit(kitId: string): Promise<UnpublishKitState> {
  await requireAdmin();
  const id = kitId.trim();
  if (!id) return { ok: false, message: "Kit não identificado." };

  const supabase = await createClient();
  const { data: kit } = await supabase.from("kits").select("slug").eq("id", id).maybeSingle();

  const { error } = await supabase
    .from("kits")
    .update({ status: KIT_STATUS_DRAFT })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  revalidatePath("/admin/kits");
  revalidatePath(`/admin/kits/${id}/edit`);
  if (kit?.slug) revalidatePath(`/kit/${kit.slug}`);

  return { ok: true, message: "Kit despublicado. Ele não aparece mais no site." };
}
