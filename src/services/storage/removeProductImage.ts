import { createClient } from "@/services/supabase/server";
import { parseProductImageStoragePath } from "./productImagePath";

function bucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET ?? "product-images";
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
