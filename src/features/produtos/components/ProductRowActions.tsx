"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteProduct } from "@/features/produtos/services/deleteProduct";

export function ProductRowActions({ productId }: { productId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Excluir este produto? Esta ação não pode ser desfeita.")) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteProduct(productId);
        if (result?.ok === false) {
          setError(result.message);
        }
      } catch {
        /* redirect() do servidor pode interromper a promise */
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        <Link
          href={`/admin/produtos/${productId}/edit`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-admin-accent hover:bg-[#1d63ed]/10"
          aria-label="Editar produto"
          title="Editar"
        >
          <Image src="/icons/editar.png" alt="" width={20} height={20} className="h-5 w-5" />
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:opacity-60"
          aria-label="Excluir produto"
          title="Excluir"
        >
          {pending ? (
            <span className="text-xs font-semibold" aria-hidden>
              …
            </span>
          ) : (
            <Image src="/icons/trash.png" alt="" width={20} height={20} className="h-5 w-5" />
          )}
        </button>
      </div>
      {error && (
        <p className="max-w-[10rem] text-right text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
