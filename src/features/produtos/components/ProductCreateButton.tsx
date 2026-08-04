"use client";

import { useTransition } from "react";

import { createDraftProduct } from "@/features/produtos/services/createDraftProduct";

type ProductCreateButtonProps = {
  disabled?: boolean;
};

export function ProductCreateButton({ disabled = false }: ProductCreateButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => {
        startTransition(async () => {
          await createDraftProduct();
        });
      }}
      className="inline-flex items-center justify-center rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1857d1] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Criando…" : "Cadastrar novo produto"}
    </button>
  );
}
