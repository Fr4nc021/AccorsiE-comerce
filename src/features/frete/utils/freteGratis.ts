import type { MelhorEnvioQuoteOption } from "@/services/melhorEnvio/types";

/** Mesmo valor da RPC `criar_pedido_checkout` (migration `frete_gratis_199`). */
export const FRETE_GRATIS_MINIMO = 199;

/**
 * `valorProdutos`: o que o cliente paga pelos produtos (desconto PIX/cartão e de kit já aplicados,
 * sem frete e sem cupom) — mesma base que a RPC usa.
 */
export function isFreteGratis(valorProdutos: number): boolean {
  return Math.round(valorProdutos * 100) >= FRETE_GRATIS_MINIMO * 100;
}

export function faltaParaFreteGratis(valorProdutos: number): number {
  return Math.max(0, Math.round((FRETE_GRATIS_MINIMO - valorProdutos) * 100) / 100);
}

/** A opção mais barata vira grátis; as demais continuam pagas (o cliente pode escolher uma mais rápida). */
export function opcaoFreteGratisId(opcoes: MelhorEnvioQuoteOption[]): string | null {
  if (opcoes.length === 0) return null;
  return [...opcoes].sort((a, b) => a.precoCentavos - b.precoCentavos)[0]?.id ?? null;
}
