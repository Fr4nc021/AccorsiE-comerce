"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { PRODUCT_STATUS_PUBLISHED } from "@/features/produtos/utils/productStatus";
import { validateProductForPublish } from "@/features/produtos/utils/validateProductForPublish";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";

export type PublishProductState =
  | { ok: true; message: string }
  | { ok: false; message: string; pending?: string[] };

export async function publishProduct(productId: string): Promise<PublishProductState> {
  await requireAdmin();
  const id = productId.trim();
  if (!id) return { ok: false, message: "Produto não identificado." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos")
    .select(
      "id, titulo, cod_produto, valor, quantidade_estoque, prod_comprimento_cm, prod_largura_cm, prod_altura_cm, prod_peso_kg, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Produto não encontrado." };

  const validation = validateProductForPublish({
    titulo: data.titulo,
    cod_produto: data.cod_produto,
    valor: data.valor != null ? Number(data.valor) : null,
    quantidade_estoque:
      data.quantidade_estoque != null ? Number(data.quantidade_estoque) : null,
    prod_comprimento_cm:
      data.prod_comprimento_cm != null ? Number(data.prod_comprimento_cm) : null,
    prod_largura_cm: data.prod_largura_cm != null ? Number(data.prod_largura_cm) : null,
    prod_altura_cm: data.prod_altura_cm != null ? Number(data.prod_altura_cm) : null,
    prod_peso_kg: data.prod_peso_kg != null ? Number(data.prod_peso_kg) : null,
  });

  if (!validation.ok) {
    return { ok: false, message: validation.message, pending: validation.pending };
  }

  const { error: updateError } = await supabase
    .from("produtos")
    .update({ status: PRODUCT_STATUS_PUBLISHED })
    .eq("id", id);

  if (updateError) return { ok: false, message: updateError.message };

  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${id}/edit`);

  return { ok: true, message: "Produto publicado com sucesso." };
}
