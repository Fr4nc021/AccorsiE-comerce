"use server";

import { slugify } from "@/utils/slugify";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateCategoriaState = { ok: false; message: string } | null;

async function allocateCategoriaSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseRaw: string,
  excludeId?: string
): Promise<string> {
  const raw = slugify(baseRaw);
  const base = raw || "categoria";
  let candidate = base;
  let n = 2;
  for (;;) {
    const { data: rows } = await supabase.from("categorias").select("id").eq("slug", candidate);
    const list = rows ?? [];
    const takenByOther = list.some((r) => (excludeId == null ? true : r.id !== excludeId));
    if (!takenByOther) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 200) return `${base}-${Date.now()}`;
  }
}

export async function createCategoria(
  _prev: CreateCategoriaState,
  formData: FormData
): Promise<CreateCategoriaState> {
  const nome = String(formData.get("nome") ?? "").trim();

  if (!nome) {
    return { ok: false, message: "Informe o nome da categoria (ex.: Freios, Filtros, Suspensão)." };
  }

  const supabase = await createClient();
  const slug = await allocateCategoriaSlug(supabase, nome);

  const { error } = await supabase.from("categorias").insert({ nome, slug });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "Já existe uma categoria com esse nome ou com o mesmo identificador (slug). Use outro nome.",
      };
    }
    return {
      ok: false,
      message: `Não foi possível salvar: ${error.message}. Tente de novo.`,
    };
  }

  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/admin");
  redirect("/admin/categorias?cadastrado=1");
}

export type UpdateCategoriaResult = { ok: true } | { ok: false; message: string };

export async function updateCategoria(formData: FormData): Promise<UpdateCategoriaResult> {
  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();

  if (!id) {
    return { ok: false, message: "Categoria inválida." };
  }
  if (!nome) {
    return { ok: false, message: "Informe o nome da categoria." };
  }

  const supabase = await createClient();
  const slug = await allocateCategoriaSlug(supabase, nome, id);

  const { error } = await supabase.from("categorias").update({ nome, slug }).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "Já existe outra categoria com esse nome ou com o mesmo identificador (slug). Ajuste o nome.",
      };
    }
    return { ok: false, message: `Não foi possível salvar: ${error.message}.` };
  }

  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/admin");
  return { ok: true };
}

export type DeleteCategoriaResult = { ok: true } | { ok: false; message: string };

export async function deleteCategoria(categoriaId: string): Promise<DeleteCategoriaResult> {
  const id = categoriaId.trim();
  if (!id) {
    return { ok: false, message: "Categoria inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("categorias").delete().eq("id", id);

  if (error) {
    return { ok: false, message: `Não foi possível excluir: ${error.message}.` };
  }

  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/admin");
  return { ok: true };
}
