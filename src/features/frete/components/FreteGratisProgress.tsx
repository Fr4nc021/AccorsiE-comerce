import {
  faltaParaFreteGratis,
  FRETE_GRATIS_MINIMO,
  isFreteGratis,
} from "@/features/frete/utils/freteGratis";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type FreteGratisProgressProps = {
  valorProdutos: number;
  className?: string;
};

export function FreteGratisProgress({ valorProdutos, className = "" }: FreteGratisProgressProps) {
  const gratis = isFreteGratis(valorProdutos);
  const falta = faltaParaFreteGratis(valorProdutos);
  const pct = Math.min(100, Math.max(0, (valorProdutos / FRETE_GRATIS_MINIMO) * 100));

  return (
    <div
      className={`rounded-sm border px-3 py-2.5 text-sm ${
        gratis ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-[#1d63ed]/30 bg-[#e8f1ff] text-[#063d9e]"
      } ${className}`}
      role="status"
    >
      {gratis ? (
        <p className="font-bold">Você ganhou frete grátis!</p>
      ) : (
        <p>
          Faltam <strong className="tabular-nums">{money.format(falta)}</strong> para ganhar{" "}
          <strong>frete grátis</strong>
        </p>
      )}
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/80"
        role="progressbar"
        aria-label="Progresso para frete grátis"
        aria-valuemin={0}
        aria-valuemax={FRETE_GRATIS_MINIMO}
        aria-valuenow={Math.min(FRETE_GRATIS_MINIMO, Math.round(valorProdutos * 100) / 100)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${gratis ? "bg-emerald-600" : "bg-[#1d63ed]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs opacity-80">
        Frete grátis na opção mais econômica para compras a partir de {money.format(FRETE_GRATIS_MINIMO)} em
        produtos.
      </p>
    </div>
  );
}
