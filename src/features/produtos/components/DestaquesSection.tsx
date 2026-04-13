import { ProductShowcaseSection } from "@/features/produtos/components/ProductShowcaseSection";
import type { ProductSummary } from "@/types/product";

const EMPTY_DEFAULT =
  'Nenhum produto em destaque. Marque "Em destaque" ao cadastrar ou editar um produto no painel.';

type DestaquesSectionProps = {
  produtos: ProductSummary[];
  emptyMessage?: string;
};

export function DestaquesSection({ produtos, emptyMessage }: DestaquesSectionProps) {
  return (
    <ProductShowcaseSection
      title="Destaques"
      headingId="home-destaques-heading"
      produtos={produtos}
      emptyMessage={emptyMessage ?? EMPTY_DEFAULT}
    />
  );
}
