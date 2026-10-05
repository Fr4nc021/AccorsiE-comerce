"use server";

import { revalidatePath } from "next/cache";
import { revalidateStoreCatalogCache } from "@/features/produtos/utils/catalogCacheTags";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/services/supabase/server";
import { removeProductImageIfUnused } from "@/services/storage/removeProductImage";

export type ReuseProductImageResult =
  | {
      ok: true;
      updatedIds: string[];
      skippedSourceIds: string[];
      message: string;
    }
  | {
      ok: false;
      message: string;
      updatedIds?: string[];
    };

async function resolveSourceFotoRef(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceProductId: string
): Promise<{ fotoRef: string | null; titulo: string }> {
  const { data: produto } = await supabase
    .from("produtos")
    .select("titulo, foto")
    .eq("id", sourceProductId)
    .maybeSingle();

  const titulo = String(produto?.titulo ?? "").trim() || "Sem título";
  const fromProduto = produto?.foto != null ? String(produto.foto).trim() : "";
  if (fromProduto) return { fotoRef: fromProduto, titulo };

  const { data: gallery } = await supabase
    .from("produto_fotos")
    .select("foto, is_principal, ordem")
    .eq("produto_id", sourceProductId)
    .order("ordem", { ascending: true });

  const rows = gallery ?? [];
  const principal = rows.find((r) => r.is_principal === true);
  const first = principal ?? rows[0];
  const fromGallery = first?.foto != null ? String(first.foto).trim() : "";
  return { fotoRef: fromGallery || null, titulo };
}

/**
 * Aplica a foto principal do produto de origem nos destinos (mesma URL, sem reupload).
 * Substitui `produtos.foto` e a galeria `produto_fotos` dos destinos por uma única foto principal.
 */
export async function reuseProductImage(input: {
  sourceProductId: string;
  destinationIds: string[];
}): Promise<ReuseProductImageResult> {
  await requireAdmin();

  const sourceProductId = String(input.sourceProductId ?? "").trim();
  const rawDestIds = Array.isArray(input.destinationIds) ? input.destinationIds : [];
  const destinationIds = [
    ...new Set(rawDestIds.map((id) => String(id ?? "").trim()).filter(Boolean)),
  ];

  if (!sourceProductId) {
    return { ok: false, message: "Produto de origem não informado." };
  }
  if (destinationIds.length === 0) {
    return { ok: false, message: "Nenhum produto de destino selecionado." };
  }

  const skippedSourceIds = destinationIds.filter((id) => id === sourceProductId);
  const destIds = destinationIds.filter((id) => id !== sourceProductId);

  if (destIds.length === 0) {
    return {
      ok: false,
      message:
        "Nenhum produto de destino válido. O produto de origem não pode ser o único selecionado.",
    };
  }

  const supabase = await createClient();
  const { fotoRef: sourceRef, titulo: sourceTitulo } = await resolveSourceFotoRef(
    supabase,
    sourceProductId
  );

  if (!sourceRef) {
    return {
      ok: false,
      message: `O produto de origem "${sourceTitulo}" não possui imagem cadastrada.`,
    };
  }

  const [{ data: beforeProdutos }, { data: beforePhotos }] = await Promise.all([
    supabase.from("produtos").select("id, foto").in("id", destIds),
    supabase.from("produto_fotos").select("produto_id, foto").in("produto_id", destIds),
  ]);

  const foundIds = new Set((beforeProdutos ?? []).map((r) => String(r.id)));
  const missing = destIds.filter((id) => !foundIds.has(id));
  const effectiveDestIds = destIds.filter((id) => foundIds.has(id));

  if (effectiveDestIds.length === 0) {
    return {
      ok: false,
      message:
        missing.length > 0
          ? "Nenhum dos produtos selecionados foi encontrado."
          : "Nenhum produto de destino válido.",
    };
  }

  const previousRefs = new Set<string>();
  for (const row of beforeProdutos ?? []) {
    const f = row.foto != null ? String(row.foto).trim() : "";
    if (f && f !== sourceRef) previousRefs.add(f);
  }
  for (const row of beforePhotos ?? []) {
    const f = row.foto != null ? String(row.foto).trim() : "";
    if (f && f !== sourceRef) previousRefs.add(f);
  }

  const { error: updateError } = await supabase
    .from("produtos")
    .update({ foto: sourceRef })
    .in("id", effectiveDestIds);

  if (updateError) {
    return {
      ok: false,
      message: `Falha ao atualizar a foto dos produtos: ${updateError.message}`,
    };
  }

  const { error: delPhotosError } = await supabase
    .from("produto_fotos")
    .delete()
    .in("produto_id", effectiveDestIds);

  if (delPhotosError) {
    return {
      ok: false,
      updatedIds: effectiveDestIds,
      message: `Foto principal atualizada, mas a galeria falhou: ${delPhotosError.message}`,
    };
  }

  const galleryRows = effectiveDestIds.map((produto_id) => ({
    produto_id,
    foto: sourceRef,
    ordem: 0,
    is_principal: true,
  }));

  const { error: insertPhotosError } = await supabase.from("produto_fotos").insert(galleryRows);

  if (insertPhotosError) {
    return {
      ok: false,
      updatedIds: effectiveDestIds,
      message: `Foto principal atualizada, mas ao gravar a galeria: ${insertPhotosError.message}`,
    };
  }

  for (const ref of previousRefs) {
    await removeProductImageIfUnused(ref);
  }

  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath("/admin");
  revalidatePath("/admin/produtos");
  for (const id of effectiveDestIds) {
    revalidatePath(`/admin/produtos/${id}/edit`);
    revalidatePath(`/produtos/${id}`);
  }
  revalidateStoreCatalogCache();

  const count = effectiveDestIds.length;
  let message = `Imagem aplicada em ${count} produto${count === 1 ? "" : "s"}.`;
  if (skippedSourceIds.length > 0) {
    message += " O produto de origem foi ignorado na atualização.";
  }
  if (missing.length > 0) {
    message += ` ${missing.length} id(s) não encontrado(s) foram ignorados.`;
  }

  return {
    ok: true,
    updatedIds: effectiveDestIds,
    skippedSourceIds,
    message,
  };
}
