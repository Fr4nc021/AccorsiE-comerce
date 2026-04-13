import { ProductDestaqueStarForm } from "@/features/produtos/components/ProductDestaqueStarForm";
import { ProductRowActions } from "@/features/produtos/components/ProductRowActions";
import { createClient } from "@/services/supabase/server";

export const metadata = {
  title: "Visão geral | Admin",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ProdutoRow = {
  id: string;
  titulo: string;
  cod_produto: string;
  valor: number;
  quantidade_estoque: number;
  em_destaque: boolean;
};

function KpiCard({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1d63ed]/10 text-admin-accent">
          {children}
        </div>
      </div>
    </div>
  );
}

function IconBoxes() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8l8-4 8 4v8l-8 4-8-4V8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M4 8l8 4M12 12v8M12 12l8-4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconStack() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 10l6 3 6-3M6 14l6 3 6-3M6 18l6 3 6-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v18M7 7h6.5a2.5 2.5 0 010 5H9a2.5 2.5 0 000 5h6M7 17h6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19V5M8 17V9M12 15v-3M16 12V7M20 10v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default async function AdminDashboardPage() {
  let produtos: ProdutoRow[] = [];
  let configError: string | null = null;
  let loadError: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("produtos")
      .select("id, titulo, cod_produto, valor, quantidade_estoque, em_destaque")
      .order("titulo");

    if (error) {
      loadError = error.message;
    } else if (data) {
      produtos = (data as ProdutoRow[]).map((row) => ({
        ...row,
        em_destaque: Boolean(row.em_destaque),
      }));
    }
  } catch (e) {
    configError = e instanceof Error ? e.message : "Erro ao carregar configuração.";
  }

  const n = produtos.length;
  const totalItens = produtos.reduce((s, p) => s + Number(p.quantidade_estoque), 0);
  const valorEstoque = produtos.reduce(
    (s, p) => s + Number(p.valor) * Number(p.quantidade_estoque),
    0
  );
  const precoMedio = n > 0 ? produtos.reduce((s, p) => s + Number(p.valor), 0) / n : 0;
  const esgotados = produtos.filter((p) => Number(p.quantidade_estoque) <= 0).length;

  return (
    <div className="space-y-6">
      {configError && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          <p className="font-semibold">Configuração</p>
          <p className="mt-1 text-amber-900/90">{configError}</p>
          <p className="mt-2 text-xs text-amber-800/80">
            Crie <code className="rounded bg-black/5 px-1">.env</code> ou{" "}
            <code className="rounded bg-black/5 px-1">.env.local</code> com NEXT_PUBLIC_SUPABASE_URL e
            NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </p>
        </div>
      )}

      {loadError && !configError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
          role="alert"
        >
          <p className="font-semibold">Erro ao carregar</p>
          <p className="mt-1">{loadError}</p>
        </div>
      )}

      {!configError && !loadError && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Produtos no catálogo"
              value={String(n)}
              hint="SKUs cadastrados"
            >
              <IconBoxes />
            </KpiCard>
            <KpiCard
              label="Unidades em estoque"
              value={totalItens.toLocaleString("pt-BR")}
              hint="Soma das quantidades"
            >
              <IconStack />
            </KpiCard>
            <KpiCard
              label="Valor em estoque"
              value={money.format(valorEstoque)}
              hint="Preço × quantidade"
            >
              <IconCurrency />
            </KpiCard>
            <KpiCard
              label="Preço médio"
              value={money.format(precoMedio)}
              hint={
                esgotados > 0
                  ? `${esgotados} sem estoque`
                  : "Média dos preços unitários"
              }
            >
              <IconTrend />
            </KpiCard>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Produtos cadastrados</h2>
              <p className="mt-0.5 text-sm text-gray-500">Lista do catálogo e ações rápidas</p>
            </div>

            {produtos.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-gray-500">
                Nenhum produto ainda. Use <span className="font-medium text-admin-accent">Criar novo produto</span>{" "}
                no topo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="w-14 px-2 py-3 text-center text-amber-500" scope="col">
                        <span className="sr-only">Destaque na home</span>
                        <span aria-hidden>★</span>
                      </th>
                      <th className="px-6 py-3">Produto</th>
                      <th className="px-6 py-3">Código</th>
                      <th className="px-6 py-3 text-right">Valor</th>
                      <th className="px-6 py-3 text-right">Estoque</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {produtos.map((p) => {
                      const q = Number(p.quantidade_estoque);
                      const inStock = q > 0;
                      return (
                        <tr key={p.id} className="text-gray-900 transition hover:bg-gray-50/80">
                          <td className="px-2 py-4">
                            <ProductDestaqueStarForm productId={p.id} emDestaque={p.em_destaque} />
                          </td>
                          <td className="px-6 py-4 font-medium">{p.titulo}</td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-600">{p.cod_produto}</td>
                          <td className="px-6 py-4 text-right tabular-nums font-medium">
                            {money.format(Number(p.valor))}
                          </td>
                          <td className="px-6 py-4 text-right tabular-nums text-gray-700">{q}</td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                                inStock
                                  ? "bg-[#1d63ed]/12 text-[#1d63ed]"
                                  : "bg-gray-100 text-gray-600",
                              ].join(" ")}
                            >
                              {inStock ? "Em estoque" : "Esgotado"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <ProductRowActions productId={p.id} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
