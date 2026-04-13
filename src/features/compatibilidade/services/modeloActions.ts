"use server";

import { slugify } from "@/utils/slugify";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateModeloState = { ok: false; message: string } | null;

/** Slug único entre os modelos da mesma marca. */
async function allocateModeloSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marcaId: string,
  baseRaw: string
): Promise<string> {
  const base = slugify(baseRaw);
  let candidate = base;
  let n = 2;
  for (;;) {
    const { data: rows } = await supabase
      .from("modelos")
      .select("id")
      .eq("marca_id", marcaId)
      .eq("slug", candidate);
    const list = rows ?? [];
    if (list.length === 0) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 200) return `${base}-${Date.now()}`;
  }
}

export async function createModelo(
  _prev: CreateModeloState,
  formData: FormData
): Promise<CreateModeloState> {
  const marcaId = String(formData.get("marca_id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();

  if (!marcaId) {
    return { ok: false, message: "Escolha a marca do veículo." };
  }
  if (!nome) {
    return { ok: false, message: "Informe o nome do modelo (ex.: Civic, Gol)." };
  }

  const supabase = await createClient();
  const slug = await allocateModeloSlug(supabase, marcaId, nome);

  const { error } = await supabase.from("modelos").insert({
    marca_id: marcaId,
    nome,
    slug,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "Já existe um modelo com esse nome para esta marca. Ajuste o nome ou escolha outra marca.",
      };
    }
    return {
      ok: false,
      message: `Não foi possível salvar: ${error.message}. Tente de novo.`,
    };
  }

  revalidatePath("/admin/marcas-e-modelos");
  revalidatePath("/admin/marcas");
  revalidatePath("/admin/modelos");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/admin");
  redirect("/admin/marcas-e-modelos?cadastrado=modelo");
}

export type ModeloAnoState = { ok: false; message: string } | null;

export async function addModeloAno(
  _prev: ModeloAnoState,
  formData: FormData
): Promise<ModeloAnoState> {
  const modeloId = String(formData.get("modelo_id") ?? "").trim();
  const anoRaw = String(formData.get("ano") ?? "").trim();

  if (!modeloId) {
    return { ok: false, message: "Modelo inválido." };
  }

  const ano = Number.parseInt(anoRaw, 10);
  if (Number.isNaN(ano) || ano < 1900 || ano > 2100) {
    return { ok: false, message: "Informe um ano entre 1900 e 2100." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("modelo_anos").insert({
    modelo_id: modeloId,
    ano,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Este ano já está cadastrado para este modelo." };
    }
    if (error.code === "42P01" || error.message.includes("modelo_anos")) {
      return {
        ok: false,
        message:
          "Tabela modelo_anos não encontrada. Execute a migration em supabase/migrations no painel SQL do Supabase.",
      };
    }
    return { ok: false, message: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/admin/marcas-e-modelos");
  revalidatePath("/admin/modelos");
  return null;
}

export async function removeModeloAno(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("modelo_anos").delete().eq("id", id);
  revalidatePath("/admin/marcas-e-modelos");
  revalidatePath("/admin/modelos");
}
