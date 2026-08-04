"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { PRODUCT_STATUS_DRAFT } from "@/features/produtos/utils/productStatus";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateDraftProductResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

async function insertEmptyDraft(): Promise<CreateDraftProductResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("produtos")
    .insert({ status: PRODUCT_STATUS_DRAFT })
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      ok: false,
      message: error?.message ?? "Não foi possível criar o produto em cadastro.",
    };
  }

  revalidatePath("/admin/produtos");
  return { ok: true, id: data.id };
}

/** Creates an empty draft and redirects to the edit page. */
export async function createDraftProduct(): Promise<void> {
  const result = await insertEmptyDraft();
  if (!result.ok) {
    redirect(`/admin/produtos?erro=${encodeURIComponent(result.message)}`);
  }
  redirect(`/admin/produtos/${result.id}/edit`);
}

/**
 * Duplicates an existing product into a new draft (status stays draft),
 * then redirects to edit. Does not publish.
 */
export async function duplicateProductAsDraft(sourceId: string): Promise<void> {
  await requireAdmin();
  const id = sourceId.trim();
  if (!id) {
    redirect(`/admin/produtos?erro=${encodeURIComponent("Produto de origem inválido.")}`);
  }

  const supabase = await createClient();

  const { data: produto, error: prodError } = await supabase
    .from("produtos")
    .select(
      "titulo, cod_produto, descricao, valor, foto, quantidade_estoque, em_destaque, somente_retirada_loja, compat_todos_modelos, prod_comprimento_cm, prod_largura_cm, prod_altura_cm, prod_peso_kg, embalagem_id, desconto_pix_percent, desconto_cartao_percent"
    )
    .eq("id", id)
    .maybeSingle();

  if (prodError || !produto) {
    redirect(
      `/admin/produtos?erro=${encodeURIComponent(
        prodError?.message ?? "Produto de origem não encontrado para duplicação."
      )}`
    );
  }

  const [{ data: compRows }, { data: fotosRows }, { data: catRows }, { data: relRows }] =
    await Promise.all([
      supabase
        .from("produto_compatibilidades")
        .select("modelo_id, ano_inicio, ano_fim")
        .eq("produto_id", id)
        .order("ano_inicio"),
      supabase
        .from("produto_fotos")
        .select("foto, is_principal, ordem")
        .eq("produto_id", id)
        .order("ordem", { ascending: true }),
      supabase.from("produto_categorias").select("categoria_id").eq("produto_id", id),
      supabase.from("produto_relacionados").select("relacionado_id").eq("produto_id", id),
    ]);

  const codeBase = String(produto.cod_produto ?? "").trim();
  const duplicatedCode = codeBase ? `${codeBase}-COPIA` : null;
  const titleBase = String(produto.titulo ?? "").trim();
  const duplicatedTitle = titleBase ? `${titleBase} COPIA` : null;

  const { data: created, error: insertError } = await supabase
    .from("produtos")
    .insert({
      status: PRODUCT_STATUS_DRAFT,
      titulo: duplicatedTitle,
      cod_produto: duplicatedCode,
      descricao: produto.descricao ?? null,
      valor: produto.valor != null ? Number(produto.valor) : null,
      foto: produto.foto ?? null,
      quantidade_estoque: 0,
      em_destaque: false,
      somente_retirada_loja: Boolean(produto.somente_retirada_loja),
      compat_todos_modelos: Boolean(produto.compat_todos_modelos),
      prod_comprimento_cm:
        produto.prod_comprimento_cm != null ? Number(produto.prod_comprimento_cm) : null,
      prod_largura_cm: produto.prod_largura_cm != null ? Number(produto.prod_largura_cm) : null,
      prod_altura_cm: produto.prod_altura_cm != null ? Number(produto.prod_altura_cm) : null,
      prod_peso_kg: produto.prod_peso_kg != null ? Number(produto.prod_peso_kg) : null,
      embalagem_id: produto.embalagem_id ?? null,
      desconto_pix_percent: Number(produto.desconto_pix_percent ?? 0),
      desconto_cartao_percent: Number(produto.desconto_cartao_percent ?? 0),
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    const message =
      insertError?.code === "23505"
        ? "Já existe um produto com o código da cópia. Ajuste o código do original ou exclua a cópia anterior."
        : (insertError?.message ?? "Falha ao duplicar produto.");
    redirect(`/admin/produtos?erro=${encodeURIComponent(message)}`);
  }

  const newId = created.id as string;

  if ((fotosRows ?? []).length > 0) {
    await supabase.from("produto_fotos").insert(
      (fotosRows ?? []).map((row) => ({
        produto_id: newId,
        foto: row.foto,
        ordem: Number.isFinite(row.ordem) ? Number(row.ordem) : 0,
        is_principal: row.is_principal === true,
      }))
    );
  }

  if (!produto.compat_todos_modelos && (compRows ?? []).length > 0) {
    await supabase.from("produto_compatibilidades").insert(
      (compRows ?? []).map((row) => ({
        produto_id: newId,
        modelo_id: row.modelo_id,
        ano_inicio: row.ano_inicio,
        ano_fim: row.ano_fim,
      }))
    );
  }

  if ((catRows ?? []).length > 0) {
    await supabase.from("produto_categorias").insert(
      (catRows ?? []).map((row) => ({
        produto_id: newId,
        categoria_id: row.categoria_id,
      }))
    );
  }

  const relIds = (relRows ?? []).map((row) => row.relacionado_id).filter(Boolean);
  if (relIds.length > 0) {
    await supabase.from("produto_relacionados").insert(
      relIds.map((relacionado_id) => ({
        produto_id: newId,
        relacionado_id,
      }))
    );
  }

  revalidatePath("/admin/produtos");
  redirect(`/admin/produtos/${newId}/edit`);
}
