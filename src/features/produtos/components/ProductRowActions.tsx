"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { duplicateProductAsDraft } from "@/features/produtos/services/createDraftProduct";
import { deleteProduct } from "@/features/produtos/services/deleteProduct";
import { getKitsContainingProduct } from "@/features/kits/services/getKitsContainingProduct";

export function ProductRowActions({ productId }: { productId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [kitNames, setKitNames] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function openDelete() {
    setError(null);
    startTransition(async () => {
      try {
        const kits = await getKitsContainingProduct(productId);
        setKitNames(kits.map((k) => k.nome));
        setDeleteOpen(true);
      } catch {
        setKitNames([]);
        setDeleteOpen(true);
      }
    });
  }

  function runDelete() {
    setDeleteOpen(false);
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

  function runDuplicate() {
    setError(null);
    startTransition(async () => {
      try {
        await duplicateProductAsDraft(productId);
      } catch {
        /* redirect() do servidor pode interromper a promise */
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir produto?"
        description={
          <span className="font-medium text-gray-800">
            {kitNames.length > 0 ? (
              <>
                Este produto faz parte dos kits: {kitNames.join(", ")}. Ao excluir, ele será removido
                desses kits. Esta ação não pode ser desfeita.
              </>
            ) : (
              <>Excluir este produto? Esta ação não pode ser desfeita.</>
            )}
          </span>
        }
        confirmLabel="Sim, excluir"
        onConfirm={runDelete}
      />
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          onClick={runDuplicate}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-semibold text-admin-accent hover:bg-[#1d63ed]/10 disabled:opacity-50"
          aria-label="Duplicar produto"
          title="Duplicar"
        >
          Duplicar
        </button>
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
          onClick={openDelete}
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
