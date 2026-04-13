/**
 * Monta a URL pública da foto do produto (URL absoluta ou caminho no bucket Supabase).
 * Espelha a lógica do painel admin (`ProductPhotoPanel`).
 */
export function resolveProductImagePublicUrl(foto: string | null | undefined): string | null {
  const t = (foto ?? "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET ?? "product-images";
  if (!base) return null;

  const path = t.replace(/^\/+/, "");
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}
