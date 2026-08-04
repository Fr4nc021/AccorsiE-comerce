"use client";

import {
  formatProductStatusBadge,
  type ProductStatus,
} from "@/features/produtos/utils/productStatus";

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const published = status === "published";
  return (
    <span
      className={
        published
          ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900"
          : "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-950"
      }
    >
      {formatProductStatusBadge(status)}
    </span>
  );
}
