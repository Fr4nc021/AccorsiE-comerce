"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteKit } from "@/features/kits/services/deleteKit";

export function KitRowActions({ kitId }: { kitId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function runDelete() {
    setDeleteOpen(false);
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteKit(kitId);
        if (result?.ok === false) setError(result.message);
      } catch {
        /* redirect */
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir kit?"
        description={<span className="font-medium text-gray-800">Esta ação não pode ser desfeita.</span>}
        confirmLabel="Sim, excluir"
        onConfirm={runDelete}
      />
      <div className="flex flex-wrap justify-end gap-1">
        <Link
          href={`/admin/kits/${kitId}/edit`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-admin-accent hover:bg-[#1d63ed]/10"
          aria-label="Editar kit"
          title="Editar"
        >
          <Image src="/icons/editar.png" alt="" width={20} height={20} className="h-5 w-5" />
        </Link>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          disabled={pending}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:opacity-60"
          aria-label="Excluir kit"
          title="Excluir"
        >
          <Image src="/icons/trash.png" alt="" width={20} height={20} className="h-5 w-5" />
        </button>
      </div>
      {error && <p className="max-w-[10rem] text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
