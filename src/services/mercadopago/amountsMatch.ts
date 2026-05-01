/**
 * Compara valor liquidado no MP com total do pedido (tolerância de 1 centavo).
 */
export function mercadoPagoAmountMatchesPedidoTotal(
  mpAmount: number,
  pedidoTotal: string | number,
): boolean {
  const pedido = typeof pedidoTotal === "number" ? pedidoTotal : Number(pedidoTotal);
  if (!Number.isFinite(pedido) || !Number.isFinite(mpAmount)) return false;
  return Math.abs(Math.round(mpAmount * 100) - Math.round(pedido * 100)) <= 1;
}
