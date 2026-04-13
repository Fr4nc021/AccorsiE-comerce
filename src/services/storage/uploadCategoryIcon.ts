import { createClient } from "@/services/supabase/client";
import { parseProductImageStoragePath } from "@/services/storage/productImagePath";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT_FROM_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function productImagesBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET ?? "product-images";
}

async function removeStorageObjectIfInBucket(ref: string): Promise<void> {
  const bucket = productImagesBucket();
  const path = parseProductImageStoragePath(ref, bucket);
  if (!path) return;
  const { error } = await createClient().storage.from(bucket).remove([path]);
  if (error && !/not found|No such file|404/i.test(error.message)) {
    /* arquivo antigo pode permanecer no bucket */
  }
}

/**
 * Envia ícone de categoria para o bucket de imagens (`categorias/`).
 * Retorna a URL pública. Opcionalmente remove o arquivo anterior no mesmo bucket.
 */
export async function uploadCategoryIconFile(
  file: File,
  options?: { replaceRef?: string | null }
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Use JPEG, PNG, WEBP ou GIF.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Arquivo muito grande (máximo 5 MB).");
  }

  const supabase = createClient();
  const bucket = productImagesBucket();
  const ext = EXT_FROM_MIME[file.type] ?? "jpg";
  const path = `categorias/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (upErr) {
    const msg =
      upErr.message.includes("JWT") ||
      upErr.message.includes("policy") ||
      upErr.message.includes("row-level security") ||
      upErr.message.includes("RLS")
        ? "Sem permissão no Storage: confira as políticas de INSERT (anon) no bucket de imagens."
        : upErr.message;
    throw new Error(msg);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  const prev = options?.replaceRef?.trim();
  if (prev && prev !== publicUrl) {
    try {
      await removeStorageObjectIfInBucket(prev);
    } catch {
      /* ignora */
    }
  }

  return publicUrl;
}
