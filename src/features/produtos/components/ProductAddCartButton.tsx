"use client";

type ProductAddCartButtonProps = {
  productTitle: string;
};

export function ProductAddCartButton({ productTitle }: ProductAddCartButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-store-accent px-3 py-2.5 text-sm font-bold text-black shadow-sm transition hover:brightness-95 active:brightness-90"
      aria-label={`Adicionar ${productTitle} ao carrinho`}
      onClick={() => {
        /* Carrinho: integrar depois */
      }}
    >
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 6h15l-1.5 9h-12L6 6zm0 0L5 3H2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z"
          fill="currentColor"
        />
      </svg>
      Adicionar ao carrinho
    </button>
  );
}
