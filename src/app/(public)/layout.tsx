import type { ReactNode } from "react";

import { StoreNavbar } from "@/components/layout/StoreNavbar";
import { CartProvider } from "@/features/carrinho/CartContext";
import { getHomeCategories } from "@/features/categorias/services/getHomeCategories";
import { getSiteLayout } from "@/features/site-layout/services/getSiteLayout";
import { getCatalogSliderMax } from "@/features/produtos/services/getCatalogProducts";
import { createClient } from "@/services/supabase/server";

const FALLBACK_HOME_BANNER = "/home/Banner%20inicial.png";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [categorias, catalogSliderMax, siteLayout, supabase] = await Promise.all([
    getHomeCategories(),
    getCatalogSliderMax(),
    getSiteLayout(),
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const accountUser = user ? { email: user.email ?? "" } : null;
  let showAdminLink = false;
  let garageVehicles: {
    id: number;
    placa: string;
    marca: string | null;
    modelo: string | null;
    modelo_id: string | null;
    ano: number | null;
  }[] = [];
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    showAdminLink = profile?.role === "admin";

    const { data: garageData } = await supabase
      .from("garagem_veiculos")
      .select("id, placa, marca, modelo, modelo_id, ano")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    garageVehicles = garageData ?? [];
  }

  const fromDb = [siteLayout.banner_1_url, siteLayout.banner_2_url]
    .map((s) => s.trim())
    .filter(Boolean);
  const homeBannerSrcs = fromDb.length > 0 ? fromDb : [FALLBACK_HOME_BANNER];

  return (
    <CartProvider>
      <StoreNavbar
        categorias={categorias}
        catalogSliderMax={catalogSliderMax}
        homeBannerSrcs={homeBannerSrcs}
        accountUser={accountUser}
        garageVehicles={garageVehicles}
        showAdminLink={showAdminLink}
      />
      {children}
    </CartProvider>
  );
}
