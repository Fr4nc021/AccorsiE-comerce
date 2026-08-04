import type { KitDiscountType } from "@/types/kit";

export type KitPricingInput = {
  tipo_desconto: KitDiscountType;
  valor_desconto: number;
  preco_final: number | null;
  items: Array<{ valor: number; quantidade: number }>;
};

export type KitPricingResult = {
  precoNormal: number;
  precoKit: number;
  economia: number;
};

export function computeKitPricing(input: KitPricingInput): KitPricingResult {
  const precoNormal = round2(
    input.items.reduce((s, it) => s + Number(it.valor) * Number(it.quantidade), 0),
  );

  let precoKit = precoNormal;
  const tipo = input.tipo_desconto;
  const vd = Number(input.valor_desconto) || 0;

  if (tipo === "preco_fixo") {
    precoKit = round2(Math.max(0, Number(input.preco_final) || 0));
  } else if (tipo === "valor_fixo") {
    precoKit = round2(Math.max(0, precoNormal - vd));
  } else {
    const pct = Math.min(100, Math.max(0, vd));
    precoKit = round2(precoNormal * (1 - pct / 100));
  }

  if (precoKit < 0) precoKit = 0;
  const economia = round2(Math.max(0, precoNormal - precoKit));
  return { precoNormal, precoKit, economia };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isKitDiscountType(v: unknown): v is KitDiscountType {
  return v === "percentual" || v === "valor_fixo" || v === "preco_fixo";
}

export function parseKitDiscountType(v: unknown): KitDiscountType {
  return isKitDiscountType(v) ? v : "percentual";
}
