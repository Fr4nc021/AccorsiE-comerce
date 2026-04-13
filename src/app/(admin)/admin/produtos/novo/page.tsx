import { createClient } from "@/services/supabase/server";
import type { CategoriaOption } from "@/features/produtos/components/ProductCategoriasFieldset";
import { ProductForm, type ModeloOption } from "@/features/produtos/components/ProductForm";

export const metadata = {
  title: "Novo produto | Admin",
};

function marcaNomeFromRow(marcas: unknown): string {
  if (marcas == null) return "?";
  const row = Array.isArray(marcas) ? marcas[0] : marcas;
  if (row && typeof row === "object" && "nome" in row) {
    return String((row as { nome: string }).nome);
  }
  return "?";
}

function sortedUniqueInts(nums: number[]): number[] {
  return [...new Set(nums)].sort((a, b) => a - b);
}

export default async function NovoProdutoPage() {
  let modelos: ModeloOption[] = [];
  let categorias: CategoriaOption[] = [];
  let configError: string | null = null;
  let loadError: string | null = null;
  let categoriasLoadError: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("modelos")
      .select("id, nome, marcas ( nome )")
      .order("nome");

    if (error) {
      loadError = error.message;
    } else if (data) {
      const { data: anosData, error: anosError } = await supabase
        .from("modelo_anos")
        .select("modelo_id, ano");

      const anosByModeloId = new Map<string, number[]>();
      if (!anosError && anosData) {
        for (const ar of anosData as { modelo_id: string; ano: number }[]) {
          const list = anosByModeloId.get(ar.modelo_id) ?? [];
          list.push(Number(ar.ano));
          anosByModeloId.set(ar.modelo_id, list);
        }
      }

      modelos = data.map((row) => ({
        id: row.id,
        nome: row.nome,
        marca_nome: marcaNomeFromRow(row.marcas),
        anos_referencia: sortedUniqueInts(anosByModeloId.get(row.id) ?? []),
      }));
    }

    const { data: catData, error: catError } = await supabase
      .from("categorias")
      .select("id, nome, icone")
      .order("nome");

    if (catError) {
      categoriasLoadError = catError.message;
    } else if (catData) {
      categorias = catData as CategoriaOption[];
    }
  } catch (e) {
    configError = e instanceof Error ? e.message : "Erro ao carregar configuração.";
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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

      {loadError && !configError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
          role="alert"
        >
          Não foi possível carregar modelos: {loadError}
        </div>
      )}

      {categoriasLoadError && !configError && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          Categorias não carregadas ({categoriasLoadError}). Você ainda pode cadastrar o produto; rode o SQL em{" "}
          <code className="rounded bg-black/5 px-1">supabase/migrations/20260411120000_categorias.sql</code> se
          necessário.
        </div>
      )}

      {!configError && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <ProductForm modelos={modelos} categorias={categorias} />
        </div>
      )}
    </div>
  );
}
