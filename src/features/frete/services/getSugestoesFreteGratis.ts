"use server";

import {
  mapProductSummaryRow,
  PRODUCT_SUMMARY_SELECT,
  type ProductSummaryRow,
} from "@/features/produtos/utils/mapProductSummaryRow";
import { unitPriceAfterPaymentDiscount } from "@/features/produtos/utils/paymentDiscount";
import { PRODUCT_STATUS_PUBLISHED } from "@/features/produtos/utils/productStatus";
import { createPublicClient } from "@/services/supabase/public";
import type { ProductSummary } from "@/types/product";

const MAX_SUGESTOES = 4;
const CANDIDATOS_POR_FAIXA = 24;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Menor preço que o cliente pode pagar (PIX ou cartão) — mesma régua do mínimo no carrinho. */
function precoMinimo(p: ProductSummary): number {
  return Math.min(
    unitPriceAfterPaymentDiscount(p.valor, "pix", p.desconto_pix_percent, p.desconto_cartao_percent),
    unitPriceAfterPaymentDiscount(p.valor, "cartao", p.desconto_pix_percent, p.desconto_cartao_percent),
  );
}

/**
 * Produtos para completar o frete grátis: primeiro os mais baratos que sozinhos fecham o valor
 * que falta; depois os mais caros abaixo disso (chegam mais perto).
 */
export async function getSugestoesFreteGratis(
  falta: number,
  excluirIds: string[],
): Promise<ProductSummary[]> {
  const alvo = Number(falta);
  if (!Number.isFinite(alvo) || alvo <= 0) return [];
  const excluir = new Set(excluirIds.filter((id) => typeof id === "string" && UUID_RE.test(id)));

  try {
    const supabase = createPublicClient();
    const base = () =>
      supabase
        .from("produtos")
        .select(PRODUCT_SUMMARY_SELECT)
        .eq("status", PRODUCT_STATUS_PUBLISHED)
        .gt("quantidade_estoque", 0)
        .or("somente_retirada_loja.is.null,somente_retirada_loja.eq.false");

    const [acima, abaixo] = await Promise.all([
      base().gte("valor", alvo).order("valor", { ascending: true }).limit(CANDIDATOS_POR_FAIXA),
      base().lt("valor", alvo).order("valor", { ascending: false }).limit(CANDIDATOS_POR_FAIXA),
    ]);

    const vistos = new Set<string>();
    const candidatos = [...(acima.data ?? []), ...(abaixo.data ?? [])]
      .map((row) => mapProductSummaryRow(row as ProductSummaryRow))
      .filter((p) => {
        if (excluir.has(p.id) || vistos.has(p.id)) return false;
        vistos.add(p.id);
        return true;
      });

    const fecham = candidatos
      .filter((p) => precoMinimo(p) >= alvo)
      .sort((a, b) => precoMinimo(a) - precoMinimo(b));
    const aproximam = candidatos
      .filter((p) => precoMinimo(p) < alvo)
      .sort((a, b) => precoMinimo(b) - precoMinimo(a));

    return [...fecham, ...aproximam].slice(0, MAX_SUGESTOES);
  } catch {
    return [];
  }
}
