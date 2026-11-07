"use client";

import { useEffect, useState } from "react";

import { getSugestoesFreteGratis } from "@/features/frete/services/getSugestoesFreteGratis";
import { ProductsGrid } from "@/features/produtos/components/ProductsGrid";
import type { ProductSummary } from "@/types/product";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type FreteGratisSugestoesProps = {
  falta: number;
  idsNoCarrinho: string[];
};

export function FreteGratisSugestoes({ falta, idsNoCarrinho }: FreteGratisSugestoesProps) {
  const [produtos, setProdutos] = useState<ProductSummary[]>([]);
  const faltaKey = falta.toFixed(2);
  const idsKey = [...idsNoCarrinho].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const alvo = Number(faltaKey);
    if (alvo <= 0) {
      queueMicrotask(() => setProdutos([]));
      return;
    }
    void getSugestoesFreteGratis(alvo, idsKey ? idsKey.split(",") : []).then((rows) => {
      if (!cancelled) setProdutos(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [faltaKey, idsKey]);

  if (falta <= 0 || produtos.length === 0) return null;

  return (
    <section
      className="rounded-sm border border-store-line/80 bg-white p-5 shadow-sm sm:p-6"
      aria-labelledby="frete-gratis-sugestoes-heading"
    >
      <h2 id="frete-gratis-sugestoes-heading" className="text-lg font-bold text-black">
        Complete seu pedido e ganhe frete grátis
      </h2>
      <p className="mt-1 text-sm text-store-navy">
        Faltam <strong className="tabular-nums text-[#1d63ed]">{money.format(falta)}</strong>. Veja algumas
        sugestões:
      </p>
      <div className="mt-4">
        <ProductsGrid variant="catalog" produtos={produtos} emptyMessage="" />
      </div>
    </section>
  );
}
