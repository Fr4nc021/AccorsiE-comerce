import Image from "next/image";
import Link from "next/link";
import type { ProductSummary } from "@/types/product";
import { ProductAddCartButton } from "@/features/produtos/components/ProductAddCartButton";
import { unitPriceAfterPaymentDiscount } from "@/features/produtos/utils/paymentDiscount";
import { isSupabaseStorageUrl } from "@/utils/isSupabaseStorageUrl";

export type { ProductSummary };

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ProductsGridProps = {
  produtos: ProductSummary[];
  emptyMessage: string;
  /** `home`: até 5 colunas no xl; `catalog`: até 4 colunas (layout vitrine + filtros). */
  variant?: "home" | "catalog";
};

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-store-navy-muted">
        Sem foto
      </div>
    );
  }

  if (!isSupabaseStorageUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL absoluta fora do Storage
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain object-center"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
      className="object-contain object-center"
    />
  );
}

export function ProductsGrid({
  produtos,
  emptyMessage,
  variant = "home",
}: ProductsGridProps) {
  if (produtos.length === 0) {
    return (
      <div
        className="rounded-sm border border-store-line/80 bg-white px-6 py-12 text-center text-sm text-store-navy-muted"
        role="status"
      >
        {emptyMessage}
      </div>
    );
  }

  const gridClass =
    variant === "catalog"
      ? "catalog-products-grid grid w-full grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-4"
      : "home-products-grid grid w-full grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  return (
    <div className="w-full">
      <ul className={gridClass}>
        {produtos.map((p) => {
          const precoPixCard = unitPriceAfterPaymentDiscount(
            p.valor,
            "pix",
            p.desconto_pix_percent,
            p.desconto_cartao_percent,
          );
          const pixDesconto = p.desconto_pix_percent > 0;
          return (
            <li key={p.id} className="min-w-0">
              <article className="relative z-0 flex h-full flex-col gap-3 bg-white p-4 sm:p-5">
                <Link
                  href={`/produtos/${p.id}`}
                  className="relative mx-auto block aspect-square w-full max-w-[500px]"
                >
                  <ProductImage src={p.imageUrl} alt={p.titulo} />
                </Link>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  <h3 className="line-clamp-3 text-left text-sm font-bold leading-snug text-black sm:text-[0.9375rem]">
                    <Link href={`/produtos/${p.id}`} className="hover:underline">
                      {p.titulo}
                    </Link>
                  </h3>
                  <div
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                    aria-label={
                      pixDesconto
                        ? `Preço no PIX ${money.format(precoPixCard)}, desconto de ${p.desconto_pix_percent}%`
                        : `Preço no PIX ${money.format(precoPixCard)}`
                    }
                  >
                    <p className="text-left text-xl font-extrabold leading-tight tabular-nums text-[#1d63ed] sm:text-2xl">
                      {money.format(precoPixCard)}
                    </p>
                    <p className="text-xs font-semibold text-orange-500 sm:text-sm">
                      {pixDesconto ? `no PIX (${p.desconto_pix_percent}% OFF)` : "no PIX"}
                    </p>
                  </div>
                  <p className="text-left text-xs font-medium text-[#1d63ed]">
                    Verifique a compatibilidade antes de comprar
                  </p>
                </div>
                <div className="mt-auto pt-1">
                  <ProductAddCartButton product={p} />
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
