import { ProductsGrid } from "@/features/produtos/components/ProductsGrid";
import { storeShellContent, storeShellInset } from "@/config/storeShell";
import type { ProductSummary } from "@/types/product";

type ProductShowcaseSectionProps = {
  title: string;
  headingId: string;
  produtos: ProductSummary[];
  emptyMessage: string;
};

export function ProductShowcaseSection({
  title,
  headingId,
  produtos,
  emptyMessage,
}: ProductShowcaseSectionProps) {
  return (
    <section
      className={`bg-store-cream py-10 sm:py-12 ${storeShellInset}`}
      aria-labelledby={headingId}
    >
      <div className={storeShellContent}>
        <header className="mb-6 sm:mb-8">
          <h2
            id={headingId}
            className="text-2xl font-bold tracking-tight text-black sm:text-3xl"
          >
            {title}
          </h2>
          <div className="mt-2 h-1 w-14 rounded-[1px] bg-store-navy sm:w-16" aria-hidden />
        </header>
        <ProductsGrid produtos={produtos} emptyMessage={emptyMessage} />
      </div>
    </section>
  );
}
