"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { KIT_STATUS_DRAFT } from "@/features/kits/utils/kitStatus";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createDraftKit(): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kits")
    .insert({
      status: KIT_STATUS_DRAFT,
      tipo_desconto: "percentual",
      valor_desconto: 0,
      nome: null,
      slug: null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    redirect(
      `/admin/kits?erro=${encodeURIComponent(error?.message ?? "Não foi possível criar o kit.")}`,
    );
  }

  revalidatePath("/admin/kits");
  redirect(`/admin/kits/${data.id}/edit`);
}
