import type { ReactNode } from "react";

import { StoreNavbar } from "@/components/layout/StoreNavbar";
import { getHomeCategories } from "@/features/categorias/services/getHomeCategories";
import { getCatalogSliderMax } from "@/features/produtos/services/getCatalogProducts";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [categorias, catalogSliderMax] = await Promise.all([getHomeCategories(), getCatalogSliderMax()]);

  return (
    <>
      <StoreNavbar categorias={categorias} catalogSliderMax={catalogSliderMax} />
      {children}
    </>
  );
}
