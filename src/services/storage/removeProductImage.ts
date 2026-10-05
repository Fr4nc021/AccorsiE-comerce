import { createClient } from "@/services/supabase/server";
import { parseProductImageStoragePath } from "./productImagePath";

function bucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET ?? "product-images";
}

type RefCountTable = "produtos" | "produto_fotos" | "kits";

async function countRowsWithRef(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: RefCountTable,
  column: "foto" | "imagem",
  fotoRef: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, fotoRef);
  if (error) return null;
  return count ?? 0;
}

/** True quando algum produto, foto da galeria ou kit ainda aponta para a mesma ref. */
export async function productImageRefStillInUse(fotoRef: string): Promise<boolean> {
  const ref = fotoRef.trim();
  if (!ref) return false;
  const supabase = await createClient();
  const counts = await Promise.all([
    countRowsWithRef(supabase, "produtos", "foto", ref),
    countRowsWithRef(supabase, "produto_fotos", "foto", ref),
    countRowsWithRef(supabase, "kits", "imagem", ref),
  ]);
  return counts.some((count) => count === null || count > 0);
}

/**
 * Apaga o arquivo só se ninguém mais referencia a URL.
 * Imagens reutilizadas entre produtos ficam no bucket.
 */
export async function removeProductImageIfUnused(fotoRef: string): Promise<void> {
  if (await productImageRefStillInUse(fotoRef)) return;
  await removeProductImageFromStorage(fotoRef);
}

/** Remove o arquivo no Storage se `fotoRef` for deste bucket. Ignora URL externa ou caminho não reconhecido. */
export async function removeProductImageFromStorage(fotoRef: string): Promise<void> {
  const bucket = bucketName();
  const path = parseProductImageStoragePath(fotoRef, bucket);
  if (!path) return;

  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error && !/not found|No such file|404/i.test(error.message)) {
    console.warn("[removeProductImageFromStorage]", error.message);
  }
}
