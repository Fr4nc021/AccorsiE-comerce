const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type FreteOpcaoPrecoProps = {
  precoCentavos: number;
  gratis: boolean;
  className?: string;
};

export function FreteOpcaoPreco({ precoCentavos, gratis, className = "" }: FreteOpcaoPrecoProps) {
  if (!gratis) {
    return <strong className={`tabular-nums ${className}`}>{money.format(precoCentavos / 100)}</strong>;
  }
  return (
    <span className={`flex shrink-0 items-baseline gap-1.5 ${className}`}>
      <s className="text-xs tabular-nums text-store-navy-muted">{money.format(precoCentavos / 100)}</s>
      <strong className="text-emerald-700">Grátis</strong>
    </span>
  );
}
