"use server";

import { assertCompatUsaAnosCadastrados } from "@/features/compatibilidade/utils/assertCompatModeloAnos";
import { parseCompatibilidadesJson } from "@/features/compatibilidade/utils/compatibilidadesForm";
import { fetchValidCategoriaIds, parseCategoriaIdsFromFormData } from "@/features/categorias/utils/productCategoriasForm";
import { createClient } from "@/services/supabase/server";
import { removeProductImageFromStorage } from "@/services/storage/removeProductImage";
import { revalidatePath } from "next/cache";

export type UpdateProductState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function updateProduct(
  _prev: UpdateProductState | null,
  formData: FormData
): Promise<UpdateProductState> {
  const id = String(formData.get("id") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const cod_produto = String(formData.get("cod_produto") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor") ?? "").replace(",", ".");
  const foto = String(formData.get("foto") ?? "").trim() || null;
  const em_destaque = formData.get("em_destaque") === "on";
  const quantidadeRaw = String(formData.get("quantidade_estoque") ?? "").trim();
  const compatJson = String(formData.get("compat_json") ?? "");
  const categoriaIdsRequested = parseCategoriaIdsFromFormData(formData);

  if (!id) return { ok: false, message: "Produto não identificado." };
  if (!titulo) return { ok: false, message: "Informe o título." };
  if (!cod_produto) return { ok: false, message: "Informe o código do produto." };

  const valor = Number.parseFloat(valorRaw);
  if (Number.isNaN(valor) || valor < 0) return { ok: false, message: "Valor inválido." };

  const quantidade_estoque = Number.parseInt(quantidadeRaw, 10);
  if (Number.isNaN(quantidade_estoque) || quantidade_estoque < 0) {
    return { ok: false, message: "Quantidade em estoque inválida." };
  }

  const compatParsed = parseCompatibilidadesJson(compatJson);
  if (!compatParsed.ok) {
    return { ok: false, message: compatParsed.message };
  }
  const compatRows = compatParsed.rows;

  const supabase = await createClient();

  const anosOk = await assertCompatUsaAnosCadastrados(supabase, compatRows);
  if (!anosOk.ok) {
    return { ok: false, message: anosOk.message };
  }

  const { data: before } = await supabase.from("produtos").select("foto").eq("id", id).maybeSingle();

  const { error: prodError } = await supabase
    .from("produtos")
    .update({
      titulo,
      cod_produto,
      descricao: descricao || null,
      valor,
      foto,
      quantidade_estoque,
      em_destaque,
    })
    .eq("id", id);

  if (prodError) {
    if (prodError.code === "23505") {
      return { ok: false, message: "Já existe outro produto com este código." };
    }
    return { ok: false, message: prodError.message };
  }

  const oldFoto = before?.foto ?? null;
  if (oldFoto && oldFoto !== foto) {
    await removeProductImageFromStorage(oldFoto);
  }

  const { error: delCompError } = await supabase
    .from("produto_compatibilidades")
    .delete()
    .eq("produto_id", id);

  if (delCompError) {
    return {
      ok: false,
      message: `Dados salvos, mas ao atualizar compatibilidade: ${delCompError.message}`,
    };
  }

  if (compatRows.length > 0) {
    const { error: compError } = await supabase.from("produto_compatibilidades").insert(
      compatRows.map((r) => ({
        produto_id: id,
        modelo_id: r.modelo_id,
        ano_inicio: r.ano_inicio,
        ano_fim: r.ano_fim,
      }))
    );

    if (compError) {
      return {
        ok: false,
        message: `Produto atualizado, mas compatibilidade falhou: ${compError.message}`,
      };
    }
  }

  const { error: delCatError } = await supabase.from("produto_categorias").delete().eq("produto_id", id);
  if (delCatError) {
    return {
      ok: false,
      message: `Dados salvos, mas ao atualizar categorias: ${delCatError.message}`,
    };
  }

  const categoriaIds = await fetchValidCategoriaIds(supabase, categoriaIdsRequested);
  if (categoriaIds.length > 0) {
    const { error: catError } = await supabase.from("produto_categorias").insert(
      categoriaIds.map((categoria_id) => ({ produto_id: id, categoria_id }))
    );
    if (catError) {
      return {
        ok: false,
        message: `Produto atualizado, mas categorias falharam: ${catError.message}`,
      };
    }
  }

  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath("/admin");
  revalidatePath(`/admin/produtos/${id}/edit`);
  revalidatePath("/admin/produtos/novo");
  return { ok: true, message: "Produto atualizado com sucesso." };
}
