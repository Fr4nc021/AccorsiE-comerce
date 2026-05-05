/**
 * Monta itens da Preference do Mercado Pago com o mesmo total do pedido no Supabase.
 * Quando há cupom, aplica fator proporcional (preços positivos — API do MP).
 */

export type PedidoItemSnapshot = {
  titulo_snapshot: string;
  cod_produto_snapshot: string;
  quantidade: number;
  preco_unitario: string | number;
};

export type MercadoPagoPreferenceLine = {
  title: string;
  description: string;
  quantity: number;
  currency_id: "BRL";
  unit_price: number;
};

function normalizeMoney(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Valor monetário inválido ao montar o checkout.");
  }
  return Math.round(n * 100) / 100;
}

/**
 * @param descontoCupom Desconto já aplicado no pedido (coluna pedidos.desconto_cupom).
 */
export function buildMercadoPagoPreferenceItems(
  itens: PedidoItemSnapshot[],
  freteValor: number,
  pedidoSubtotal: number,
  pedidoFrete: number,
  pedidoTotal: number,
  descontoCupom: number,
): MercadoPagoPreferenceLine[] {
  const nFreteShown = normalizeMoney(freteValor);
  const nSub = normalizeMoney(pedidoSubtotal);
  const nFreteDb = normalizeMoney(pedidoFrete);
  const nTotal = normalizeMoney(pedidoTotal);
  const nDesc = normalizeMoney(descontoCupom);

  const preferenceItems: MercadoPagoPreferenceLine[] = itens.map((row) => ({
    title: row.titulo_snapshot.slice(0, 256),
    description: row.cod_produto_snapshot.slice(0, 256),
    quantity: row.quantidade,
    currency_id: "BRL",
    unit_price: normalizeMoney(row.preco_unitario),
  }));

  if (nFreteShown > 0) {
    preferenceItems.push({
      title: "Frete",
      description: "Envio",
      quantity: 1,
      currency_id: "BRL",
      unit_price: nFreteShown,
    });
  }

  const rawSum = nSub + nFreteDb;
  if (nDesc <= 0.005 || rawSum <= 0) {
    return preferenceItems;
  }

  const factor = nTotal / rawSum;

  const scaled: MercadoPagoPreferenceLine[] = itens.map((row) => ({
    title: row.titulo_snapshot.slice(0, 256),
    description: row.cod_produto_snapshot.slice(0, 256),
    quantity: row.quantidade,
    currency_id: "BRL",
    unit_price: normalizeMoney(normalizeMoney(row.preco_unitario) * factor),
  }));

  let freteScaled = nFreteShown > 0 ? normalizeMoney(nFreteShown * factor) : 0;
  const linesForSum = [...scaled];
  if (freteScaled > 0) {
    linesForSum.push({
      title: "Frete",
      description: "Envio",
      quantity: 1,
      currency_id: "BRL",
      unit_price: freteScaled,
    });
  }

  let sumLines = linesForSum.reduce((s, it) => s + it.unit_price * it.quantity, 0);
  let drift = normalizeMoney(nTotal - sumLines);
  if (Math.abs(drift) >= 0.01) {
    if (freteScaled > 0) {
      freteScaled = normalizeMoney(freteScaled + drift);
      sumLines = scaled.reduce((s, it) => s + it.unit_price * it.quantity, 0) + freteScaled;
      drift = normalizeMoney(nTotal - sumLines);
    }
    if (Math.abs(drift) >= 0.01 && scaled.length > 0) {
      const last = scaled[scaled.length - 1]!;
      const q = last.quantity;
      last.unit_price = normalizeMoney(last.unit_price + drift / q);
    }
  }

  const out: MercadoPagoPreferenceLine[] = [...scaled];
  if (freteScaled > 0) {
    out.push({
      title: "Frete",
      description: "Envio",
      quantity: 1,
      currency_id: "BRL",
      unit_price: freteScaled,
    });
  }

  return out;
}
