import Link from "next/link";
import { createClient } from "@/services/supabase/server";
import { MarcaForm } from "@/features/marcas/components/MarcaForm";
import { MarcaRow } from "@/features/marcas/components/MarcaRow";
import { ModeloAnosCell } from "@/features/compatibilidade/components/ModeloAnosCell";
import { ModeloForm, type MarcaOption } from "@/features/compatibilidade/components/ModeloForm";

export const metadata = {
  title: "Marcas e modelos | Admin",
};

function marcaNomeFromRow(marcas: unknown): string {
  if (marcas == null) return "?";
  const row = Array.isArray(marcas) ? marcas[0] : marcas;
  if (row && typeof row === "object" && "nome" in row) {
    return String((row as { nome: string }).nome);
  }
  return "?";
}

type MarcaListRow = {
  id: string;
  nome: string;
};

type ModeloRow = {
  id: string;
  nome: string;
  marcas: unknown;
};

type ModeloAnoRow = {
  id: string;
  modelo_id: string;
  ano: number;
};

export default async function MarcasEModelosPage({
  searchParams,
}: {
  searchParams: Promise<{ cadastrado?: string }>;
}) {
  const { cadastrado } = await searchParams;
  const showMarcaOk = cadastrado === "marca";
  const showModeloOk = cadastrado === "modelo";

  let marcas: MarcaListRow[] = [];
  let marcasForSelect: MarcaOption[] = [];
  let modelos: ModeloRow[] = [];
  let configError: string | null = null;
  let marcasError: string | null = null;
  let modelosError: string | null = null;
  let modeloAnosError: string | null = null;
  const anosByModelo = new Map<string, { id: string; ano: number }[]>();

  try {
    const supabase = await createClient();

    const { data: marcasData, error: marcasErr } = await supabase
      .from("marcas")
      .select("id, nome")
      .order("nome");

    if (marcasErr) {
      marcasError = marcasErr.message;
    } else if (marcasData) {
      marcas = marcasData as MarcaListRow[];
      marcasForSelect = marcasData as MarcaOption[];
    }

    const { data: modelosData, error: modelosErr } = await supabase
      .from("modelos")
      .select("id, nome, marcas ( nome )")
      .order("nome");

    if (modelosErr) {
      modelosError = modelosErr.message;
    } else if (modelosData) {
      modelos = modelosData as ModeloRow[];
    }

    const { data: anosData, error: anosErr } = await supabase
      .from("modelo_anos")
      .select("id, modelo_id, ano")
      .order("ano", { ascending: true });

    if (anosErr) {
      modeloAnosError = anosErr.message;
    } else if (anosData) {
      for (const row of anosData as ModeloAnoRow[]) {
        const list = anosByModelo.get(row.modelo_id) ?? [];
        list.push({ id: row.id, ano: row.ano });
        anosByModelo.set(row.modelo_id, list);
      }
    }
  } catch (e) {
    configError = e instanceof Error ? e.message : "Erro ao carregar configuração.";
  }

  return (
    <div className="space-y-12">
      {configError && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          <p className="font-semibold">Configuração</p>
          <p className="mt-1">{configError}</p>
          <p className="mt-2 text-xs text-amber-800/80">
            Crie <code className="rounded bg-black/5 px-1">.env</code> ou{" "}
            <code className="rounded bg-black/5 px-1">.env.local</code> com NEXT_PUBLIC_SUPABASE_URL e
            NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </p>
        </div>
      )}

      {!configError && showMarcaOk && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm"
          role="status"
        >
          <p className="font-semibold text-emerald-900">Marca cadastrada</p>
          <p className="mt-1 text-emerald-800/95">
            Ela já aparece na lista abaixo e no cadastro de modelos nesta mesma página.
          </p>
        </div>
      )}

      {!configError && showModeloOk && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm"
          role="status"
        >
          <p className="font-semibold text-emerald-900">Modelo cadastrado</p>
          <p className="mt-1 text-emerald-800/95">Ele já pode ser usado na compatibilidade dos produtos.</p>
        </div>
      )}

      {!configError && marcasError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
          role="alert"
        >
          Não foi possível carregar marcas: {marcasError}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Marcas de veículo</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Cadastre fabricantes; em seguida associe modelos na seção seguinte.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start">
          {!configError && (
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <h3 className="text-base font-semibold text-gray-900">Nova marca</h3>
              <p className="mt-1 text-sm text-gray-500">Ex.: Honda, Volkswagen, Fiat.</p>
              <div className="mt-6">
                <MarcaForm />
              </div>
            </div>
          )}

          {!configError && (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h3 className="text-base font-semibold text-gray-900">Marcas cadastradas</h3>
                <p className="mt-0.5 text-sm text-gray-500">Edite ou remova; modelos vinculados bloqueiam exclusão.</p>
              </div>

              {marcasError && (
                <p className="px-6 py-6 text-sm text-red-700">Erro ao listar marcas: {marcasError}</p>
              )}

              {!marcasError && marcas.length === 0 && (
                <p className="px-6 py-10 text-center text-sm text-gray-500">
                  Nenhuma marca ainda. Cadastre a primeira ao lado para habilitar modelos.
                </p>
              )}

              {!marcasError && marcas.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-6 py-3">Nome</th>
                        <th className="w-[1%] px-4 py-3 text-right font-semibold normal-case tracking-normal">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {marcas.map((m) => (
                        <MarcaRow key={m.id} marca={m} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Modelos de veículo</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Cada modelo pertence a uma marca. Anos de referência ajudam a padronizar listas.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start">
          {!configError && (
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
              <h3 className="text-base font-semibold text-gray-900">Novo modelo</h3>
              <p className="mt-1 text-sm text-gray-500">Escolha a marca e informe o nome do modelo.</p>
              <div className="mt-6">
                {marcasForSelect.length === 0 && !marcasError ? (
                  <p className="text-sm text-gray-600">
                    Nenhuma marca ainda. Cadastre uma marca na seção acima para habilitar modelos.
                  </p>
                ) : (
                  <ModeloForm marcas={marcasForSelect} />
                )}
              </div>
            </div>
          )}

          {!configError && (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h3 className="text-base font-semibold text-gray-900">Modelos cadastrados</h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  Anos de referência por modelo; a compatibilidade do produto usa ano inicial e final.
                </p>
                {modeloAnosError && (
                  <p className="mt-2 text-xs text-amber-800">
                    Não foi possível carregar anos de referência ({modeloAnosError}). Se a tabela ainda não existe,
                    rode o SQL em{" "}
                    <code className="rounded bg-gray-100 px-1">supabase/migrations/20260409120000_modelo_anos.sql</code>
                    .
                  </p>
                )}
              </div>

              {modelosError && (
                <p className="px-6 py-6 text-sm text-red-700">Erro ao listar modelos: {modelosError}</p>
              )}

              {!modelosError && modelos.length === 0 && (
                <p className="px-6 py-10 text-center text-sm text-gray-500">
                  Nenhum modelo ainda. Cadastre o primeiro ao lado ou em{" "}
                  <Link href="/admin/produtos/novo" className="font-medium text-admin-accent hover:underline">
                    novo produto
                  </Link>
                  .
                </p>
              )}

              {!modelosError && modelos.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-6 py-3">Marca</th>
                        <th className="px-6 py-3">Modelo</th>
                        <th className="min-w-[14rem] px-6 py-3">Anos de referência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {modelos.map((m) => (
                        <tr key={m.id} className="align-top text-gray-900 transition hover:bg-gray-50/80">
                          <td className="px-6 py-3.5">{marcaNomeFromRow(m.marcas)}</td>
                          <td className="px-6 py-3.5 font-medium">{m.nome}</td>
                          <td className="px-6 py-3.5">
                            {!modeloAnosError ? (
                              <ModeloAnosCell modeloId={m.id} anos={anosByModelo.get(m.id) ?? []} />
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
