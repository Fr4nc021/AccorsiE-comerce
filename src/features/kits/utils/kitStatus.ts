import {
  PRODUCT_STATUS_DRAFT,
  PRODUCT_STATUS_PUBLISHED,
  formatProductStatusBadge,
  parseProductStatus,
  type ProductStatus,
} from "@/features/produtos/utils/productStatus";

export type KitStatus = ProductStatus;

export const KIT_STATUS_DRAFT = PRODUCT_STATUS_DRAFT;
export const KIT_STATUS_PUBLISHED = PRODUCT_STATUS_PUBLISHED;

export const parseKitStatus = parseProductStatus;
export const formatKitStatusBadge = formatProductStatusBadge;
