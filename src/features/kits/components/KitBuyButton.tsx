"use client";

import { useCart } from "@/features/carrinho/CartContext";
import type { KitDetail } from "@/types/kit";

export function KitBuyButton({ kit }: { kit: KitDetail }) {
  const { addKit } = useCart();

  const disabled = kit.items.some((it) => it.quantidade_estoque < it.quantidade);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        addKit(
          {
            kitId: kit.id,
            nome: kit.nome,
            items: Object.fromEntries(kit.items.map((it) => [it.product_id, it.quantidade])),
            economia: kit.economia,
          },
          kit.items.map((it) => ({
            id: it.product_id,
            titulo: it.titulo,
            cod_produto: it.cod_produto,
            valor: it.valor,
            imageUrl: it.imageUrl,
            quantidade_estoque: it.quantidade_estoque,
            desconto_pix_percent: it.desconto_pix_percent,
            desconto_cartao_percent: it.desconto_cartao_percent,
            somente_retirada_loja: it.somente_retirada_loja,
            quantity: it.quantidade,
          })),
        );
      }}
      className="inline-flex w-full items-center justify-center rounded-sm bg-store-accent px-5 py-3.5 text-sm font-bold text-black shadow-sm transition enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {disabled ? "Indisponível" : "Comprar Kit"}
    </button>
  );
}
