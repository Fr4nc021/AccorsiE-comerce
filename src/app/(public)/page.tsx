import { CategoriesSection } from "@/features/categorias/components/CategoriesSection";
import { DestaquesSection } from "@/features/produtos/components/DestaquesSection";
import { ProductsSection } from "@/features/produtos/components/ProductsSection";
import { VehicleFilter } from "@/features/compatibilidade/components/VehicleFilter";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getHomeCategories } from "@/features/categorias/services/getHomeCategories";
import { getHomeProducts } from "@/features/produtos/services/getHomeProducts";
import { parseProductSearchQ } from "@/features/produtos/utils/catalogSearchParams";
import { storeShellContent, storeShellInset } from "@/config/storeShell";
import type { CategoryListItem } from "@/types/category";
import type { ProductSummary } from "@/types/product";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let categorias: CategoryListItem[] = [];
  let produtosDestaque: ProductSummary[] = [];
  let produtosVitrine: ProductSummary[] = [];

  const sp = await searchParams;
  const searchQ = parseProductSearchQ(sp);

  const [cats, prods] = await Promise.all([
    getHomeCategories(),
    getHomeProducts({ q: searchQ }),
  ]);
  categorias = cats;
  produtosDestaque = prods.destaque;
  produtosVitrine = prods.vitrine;

  const emptyDestaque = searchQ
    ? "Nenhum destaque corresponde à busca. Tente outro termo ou limpe o campo de pesquisa."
    : undefined;
  const emptyVitrine = searchQ
    ? "Nenhum produto corresponde à busca. Tente outro termo ou limpe o campo de pesquisa."
    : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-store-cream font-sans text-store-navy">
      <VehicleFilter />

      <section className={`border-b border-store-line/50 bg-store-cream py-10 sm:py-12 ${storeShellInset}`}>
        <div className={storeShellContent}>
          <CategoriesSection categorias={categorias} />
        </div>
      </section>

      <main className="flex flex-1 flex-col">
        <DestaquesSection produtos={produtosDestaque} emptyMessage={emptyDestaque} />
        <ProductsSection produtos={produtosVitrine} emptyMessage={emptyVitrine} />
      </main>

      <SiteFooter />
    </div>
  );
}
