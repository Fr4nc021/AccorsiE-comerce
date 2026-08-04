export type ProductStatus = "draft" | "published";

export const PRODUCT_STATUS_DRAFT: ProductStatus = "draft";
export const PRODUCT_STATUS_PUBLISHED: ProductStatus = "published";

/** Supabase filter value for storefront queries. */
export const PUBLISHED_STATUS_EQ = "published" as const;

export function isProductStatus(value: unknown): value is ProductStatus {
  return value === "draft" || value === "published";
}

export function parseProductStatus(value: unknown): ProductStatus {
  return isProductStatus(value) ? value : "draft";
}

export function productStatusLabel(status: ProductStatus): string {
  return status === "published" ? "Publicado" : "Em cadastro";
}

export function productStatusEmoji(status: ProductStatus): string {
  return status === "published" ? "🟢" : "🟡";
}

export function formatProductStatusBadge(status: ProductStatus): string {
  return `${productStatusEmoji(status)} ${productStatusLabel(status)}`;
}
