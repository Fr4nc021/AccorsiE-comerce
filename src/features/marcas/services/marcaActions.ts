"use server";

import { slugify } from "@/utils/slugify";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateMarcaState = { ok: false; message: string } | null;

/** excludeMarcaId: ao editar, ignora a própria linha na checagem de slug. */
async function allocateMarcaSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseRaw: string,
  excludeMarcaId?: string
): Promise<string> {
  const base = slugify(baseRaw);
  let candidate = base;
  let n = 2;
  for (;;) {
    const { data: rows } = await supabase.from("marcas").select("id").eq("slug", candidate);
    const list = rows ?? [];
    const takenByOther = list.some((r) =>
      excludeMarcaId == null ? true : r.id !== excludeMarcaId
    );
    if (!takenByOther) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 200) return `${base}-${Date.now()}`;
  }
}

export async function createMarca(
  _prev: CreateMarcaState,
  formData: FormData
): Promise<CreateMarcaState> {
  const nome = String(formData.get("nome") ?? "").trim();

  if (!nome) {
    return { ok: false, message: "Informe o nome da marca (ex.: Honda, Volkswagen)." };
  }

  const supabase = await createClient();
  const slug = await allocateMarcaSlug(supabase, nome);

  const { error } = await supabase.from("marcas").insert({ nome, slug });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "Já existe uma marca com esse nome ou com o mesmo identificador (slug). Use outro nome ou verifique a lista.",
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
  redirect("/admin/marcas-e-modelos?cadastrado=marca");
}

export type UpdateMarcaResult = { ok: true } | { ok: false; message: string };

export async function updateMarca(formData: FormData): Promise<UpdateMarcaResult> {
  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();

  if (!id) {
    return { ok: false, message: "Marca inválida." };
  }
  if (!nome) {
    return { ok: false, message: "Informe o nome da marca." };
  }

  const supabase = await createClient();
  const slug = await allocateMarcaSlug(supabase, nome, id);

  const { error } = await supabase.from("marcas").update({ nome, slug }).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "Já existe outra marca com esse nome ou com o mesmo identificador (slug). Ajuste o nome.",
      };
    }
    return { ok: false, message: `Não foi possível salvar: ${error.message}.` };
  }

  revalidatePath("/admin/marcas-e-modelos");
  revalidatePath("/admin/marcas");
  revalidatePath("/admin/modelos");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/admin");
  return { ok: true };
}

export type DeleteMarcaResult = { ok: true } | { ok: false; message: string };

export async function deleteMarca(marcaId: string): Promise<DeleteMarcaResult> {
  const id = marcaId.trim();
  if (!id) {
    return { ok: false, message: "Marca inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("marcas").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        message:
          "Não é possível excluir: existem modelos vinculados a esta marca. Remova ou altere os modelos primeiro.",
      };
    }
    return { ok: false, message: `Não foi possível excluir: ${error.message}.` };
  }

  revalidatePath("/admin/marcas-e-modelos");
  revalidatePath("/admin/marcas");
  revalidatePath("/admin/modelos");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/admin");
  return { ok: true };
}
