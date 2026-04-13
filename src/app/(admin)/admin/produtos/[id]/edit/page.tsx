import { notFound } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import type { CategoriaOption } from "@/features/produtos/components/ProductCategoriasFieldset";
import { ProductEditForm, type ModeloOption, type ProductEditValues } from "@/features/produtos/components/ProductEditForm";

type PageProps = { params: Promise<{ id: string }> };

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

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("produtos").select("titulo").eq("id", id).maybeSingle();
    if (data?.titulo) {
      return { title: `${data.titulo} | Editar | Admin` };
    }
  } catch {
    /* ignore */
  }
  return { title: "Editar produto | Admin" };
}

export default async function EditProdutoPage({ params }: PageProps) {
  const { id } = await params;

  let modelos: ModeloOption[] = [];
  let categorias: CategoriaOption[] = [];
  let productValues: ProductEditValues | null = null;
  let configError: string | null = null;
  let produtoLoadError: string | null = null;
  let modelosLoadError: string | null = null;
  let categoriasLoadError: string | null = null;

  try {
    const supabase = await createClient();

    const { data: produto, error: prodError } = await supabase
      .from("produtos")
      .select("id, titulo, cod_produto, descricao, valor, foto, quantidade_estoque, em_destaque")
      .eq("id", id)
      .maybeSingle();

    if (prodError) {
      produtoLoadError = prodError.message;
    } else if (!produto) {
      notFound();
    } else {
      const { data: compRows } = await supabase
        .from("produto_compatibilidades")
        .select("modelo_id, ano_inicio, ano_fim")
        .eq("produto_id", id)
        .order("ano_inicio");

      const { data: catLinkRows, error: catLinkErr } = await supabase
        .from("produto_categorias")
        .select("categoria_id")
        .eq("produto_id", id);

      if (catLinkErr) {
        categoriasLoadError = catLinkErr.message;
      }

      productValues = {
        id: produto.id,
        titulo: produto.titulo,
        cod_produto: produto.cod_produto,
        descricao: produto.descricao ?? "",
        valor: Number(produto.valor),
        foto: produto.foto ?? "",
        quantidade_estoque: produto.quantidade_estoque,
        em_destaque: Boolean(produto.em_destaque),
        categoria_ids: catLinkErr ? [] : (catLinkRows ?? []).map((r) => r.categoria_id),
        compat_rows: (compRows ?? []).map((c) => ({
          modelo_id: c.modelo_id,
          ano_inicio: c.ano_inicio != null ? String(c.ano_inicio) : "",
          ano_fim: c.ano_fim != null ? String(c.ano_fim) : "",
        })),
      };
    }

    const { data: modeloRows, error: modeloError } = await supabase
      .from("modelos")
      .select("id, nome, marcas ( nome )")
      .order("nome");

    if (modeloError) {
      modelosLoadError = modeloError.message;
    } else if (modeloRows) {
      const { data: anosData } = await supabase.from("modelo_anos").select("modelo_id, ano");

      const anosByModeloId = new Map<string, number[]>();
      if (anosData) {
        for (const ar of anosData as { modelo_id: string; ano: number }[]) {
          const list = anosByModeloId.get(ar.modelo_id) ?? [];
          list.push(Number(ar.ano));
          anosByModeloId.set(ar.modelo_id, list);
        }
      }

      const extrasPorModelo = new Map<string, Set<number>>();
      if (productValues) {
        for (const c of productValues.compat_rows) {
          if (!c.modelo_id) continue;
          const s = extrasPorModelo.get(c.modelo_id) ?? new Set<number>();
          const ai = Number.parseInt(c.ano_inicio, 10);
          const af = Number.parseInt(c.ano_fim, 10);
          if (!Number.isNaN(ai)) s.add(ai);
          if (!Number.isNaN(af)) s.add(af);
          extrasPorModelo.set(c.modelo_id, s);
        }
      }

      modelos = modeloRows.map((row) => {
        const base = sortedUniqueInts(anosByModeloId.get(row.id) ?? []);
        const ex = extrasPorModelo.get(row.id);
        const merged = ex ? sortedUniqueInts([...base, ...ex]) : base;
        return {
          id: row.id,
          nome: row.nome,
          marca_nome: marcaNomeFromRow(row.marcas),
          anos_referencia: merged,
        };
      });
    }

    const { data: catRows, error: catErr } = await supabase
      .from("categorias")
      .select("id, nome, icone")
      .order("nome");

    if (catErr) {
      if (!categoriasLoadError) categoriasLoadError = catErr.message;
    } else if (catRows) {
      categorias = catRows as CategoriaOption[];
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
        </div>
      )}

      {produtoLoadError && !configError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
          role="alert"
        >
          Não foi possível carregar o produto: {produtoLoadError}
        </div>
      )}

      {modelosLoadError && !configError && productValues && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          Modelos não carregados ({modelosLoadError}). Você ainda pode editar os demais campos.
        </div>
      )}

      {categoriasLoadError && !configError && productValues && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          Categorias não carregadas ({categoriasLoadError}). Rode o SQL em{" "}
          <code className="rounded bg-black/5 px-1">supabase/migrations/20260411120000_categorias.sql</code> se
          necessário.
        </div>
      )}

      {!configError && !produtoLoadError && productValues && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <ProductEditForm product={productValues} modelos={modelos} categorias={categorias} />
        </div>
      )}
    </div>
  );
}
