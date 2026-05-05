"use server";

import { createClient } from "@/services/supabase/server";

export type PreviewCupomResult =
  | { ok: true; desconto: number }
  | { ok: false; message: string };

/**
 * Estima o desconto para exibir no checkout (o valor final é validado de novo em criar_pedido_checkout).
 */
export async function previewCupomDesconto(
  codigo: string,
  subtotal: number,
  frete: number,
): Promise<PreviewCupomResult> {
  const trimmed = codigo.trim();
  if (!trimmed) {
    return { ok: false, message: "Informe o código do cupom." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Faça login para usar um cupom." };
  }

  const base = Math.round((Number(subtotal) + Number(frete)) * 100) / 100;
  if (!Number.isFinite(base) || base <= 0) {
    return { ok: false, message: "Calcule o frete antes de aplicar o cupom." };
  }

  const { data, error } = await supabase.rpc("calcular_cupom_desconto", {
    p_codigo: trimmed,
    p_base: base,
  });

  if (error) {
    return { ok: false, message: error.message || "Não foi possível validar o cupom." };
  }

  let row: Record<string, unknown>;
  if (data != null && typeof data === "object" && !Array.isArray(data)) {
    row = data as Record<string, unknown>;
  } else if (typeof data === "string") {
    try {
      row = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return { ok: false, message: "Resposta inválida ao validar o cupom." };
    }
  } else {
    return { ok: false, message: "Resposta inválida ao validar o cupom." };
  }

  if (row.ok !== true) {
    const msg = typeof row.message === "string" ? row.message : "Cupom inválido.";
    return { ok: false, message: msg };
  }

  const desconto =
    typeof row.desconto === "number" ? row.desconto : Number(String(row.desconto ?? NaN));
  if (!Number.isFinite(desconto) || desconto < 0) {
    return { ok: false, message: "Cupom inválido." };
  }

  return { ok: true, desconto: Math.round(desconto * 100) / 100 };
}
