"use server";

import { assertCompatUsaAnosCadastrados } from "@/features/compatibilidade/utils/assertCompatModeloAnos";
import { parseCompatibilidadesJson } from "@/features/compatibilidade/utils/compatibilidadesForm";
import { fetchValidCategoriaIds, parseCategoriaIdsFromFormData } from "@/features/categorias/utils/productCategoriasForm";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";

export type CreateProductState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function createProduct(
  _prev: CreateProductState | null,
  formData: FormData
): Promise<CreateProductState> {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const cod_produto = String(formData.get("cod_produto") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor") ?? "").replace(",", ".");
  const foto = String(formData.get("foto") ?? "").trim() || null;
  const em_destaque = formData.get("em_destaque") === "on";
  const quantidadeRaw = String(formData.get("quantidade_estoque") ?? "").trim();
  const compatJson = String(formData.get("compat_json") ?? "");
  const categoriaIdsRequested = parseCategoriaIdsFromFormData(formData);

  if (!titulo) return { ok: false, message: "Faltou o título. Preencha e tente de novo." };
  if (!cod_produto) {
    return { ok: false, message: "Faltou o código do produto. Ele identifica o item no sistema." };
  }

  const valor = Number.parseFloat(valorRaw);
  if (Number.isNaN(valor) || valor < 0) {
    return { ok: false, message: "O valor em reais não está válido. Use números iguais ou acima de zero." };
  }

  const quantidade_estoque = Number.parseInt(quantidadeRaw, 10);
  if (Number.isNaN(quantidade_estoque) || quantidade_estoque < 0) {
    return { ok: false, message: "A quantidade em estoque precisa ser um número inteiro maior ou igual a zero." };
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

  const { data: produto, error: prodError } = await supabase
    .from("produtos")
    .insert({
      titulo,
      cod_produto,
      descricao: descricao || null,
      valor,
      foto,
      quantidade_estoque,
      em_destaque,
    })
    .select("id")
    .single();

  if (prodError) {
    if (prodError.code === "23505") {
      return {
        ok: false,
        message: "Já existe um produto com este código. Escolha outro código ou edite o cadastro existente no painel.",
      };
    }
    return {
      ok: false,
      message: `Não foi possível salvar: ${prodError.message}. Tente de novo ou volte ao painel.`,
    };
  }

  if (compatRows.length > 0) {
    const { error: compError } = await supabase.from("produto_compatibilidades").insert(
      compatRows.map((r) => ({
        produto_id: produto.id,
        modelo_id: r.modelo_id,
        ano_inicio: r.ano_inicio,
        ano_fim: r.ano_fim,
      }))
    );

    if (compError) {
      return {
        ok: false,
        message: `O produto foi criado, mas a compatibilidade não pôde ser salva: ${compError.message}. Você pode editar o produto no painel para ajustar.`,
      };
    }
  }

  const categoriaIds = await fetchValidCategoriaIds(supabase, categoriaIdsRequested);
  if (categoriaIds.length > 0) {
    const { error: catError } = await supabase.from("produto_categorias").insert(
      categoriaIds.map((categoria_id) => ({ produto_id: produto.id, categoria_id }))
    );
    if (catError) {
      return {
        ok: false,
        message: `O produto foi criado, mas as categorias não puderam ser salvas: ${catError.message}. Edite o produto para vincular de novo.`,
      };
    }
  }

  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath("/admin");
  revalidatePath("/admin/produtos/novo");
  return {
    ok: true,
    message: "Sucesso ao cadastrar produto!",
  };
}
