import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeTipoVeiculoModeloFromDb,
  TIPO_VEICULO_MODELO_LABELS,
} from "@/features/compatibilidade/constants/tipoVeiculoModelo";
import { parseProductStatus, productStatusLabel } from "@/features/produtos/utils/productStatus";
import {
  buildSimpleXlsx,
  XLSX_CONTENT_TYPE,
  type SimpleXlsxSheet,
} from "@/utils/simpleXlsx";

const PAGE_SIZE = 1000;

type ProdutoRow = {
  id: string;
  titulo: string | null;
  cod_produto: string | null;
  status: string | null;
  compat_todos_modelos: boolean | null;
};

type CompatRow = {
  produto_id: string;
  modelo_id: string;
  ano_inicio: number;
  ano_fim: number;
};

type ModeloRow = {
  id: string;
  nome: string | null;
  slug: string | null;
  tipo_veiculo: string | null;
  marca_id: string;
};

type MarcaRow = {
  id: string;
  nome: string | null;
  slug: string | null;
};

export type ProductCompatReportResult =
  | { ok: true; filename: string; bytes: Uint8Array; contentType: string }
  | { ok: false; message: string };

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function comparePt(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { rows, error: null };
}

function reportFilename(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `produtos-compatibilidades-${yyyy}-${mm}-${dd}.xlsx`;
}

/**
 * Backup dos vínculos produto × modelo atuais, para relinkar depois de recriar o catálogo.
 * Não inclui modelo_id como chave de restauração: esses UUIDs somem na exclusão.
 */
export async function buildProductCompatReport(
  supabase: SupabaseClient
): Promise<ProductCompatReportResult> {
  const [produtosRes, compatRes, modelosRes, marcasRes] = await Promise.all([
    fetchAllPages<ProdutoRow>((from, to) =>
      supabase
        .from("produtos")
        .select("id, titulo, cod_produto, status, compat_todos_modelos")
        .order("id")
        .range(from, to)
    ),
    fetchAllPages<CompatRow>((from, to) =>
      supabase
        .from("produto_compatibilidades")
        .select("produto_id, modelo_id, ano_inicio, ano_fim")
        .order("produto_id")
        .order("modelo_id")
        .order("ano_inicio")
        .range(from, to)
    ),
    fetchAllPages<ModeloRow>((from, to) =>
      supabase
        .from("modelos")
        .select("id, nome, slug, tipo_veiculo, marca_id")
        .order("id")
        .range(from, to)
    ),
    fetchAllPages<MarcaRow>((from, to) =>
      supabase.from("marcas").select("id, nome, slug").order("id").range(from, to)
    ),
  ]);

  const firstError =
    produtosRes.error ?? compatRes.error ?? modelosRes.error ?? marcasRes.error;
  if (firstError) {
    return { ok: false, message: firstError };
  }

  const marcasById = new Map(marcasRes.rows.map((marca) => [marca.id, marca]));
  const modelosById = new Map(modelosRes.rows.map((modelo) => [modelo.id, modelo]));
  const produtosById = new Map(produtosRes.rows.map((produto) => [produto.id, produto]));

  const produtoIdsPorModelo = new Map<string, Set<string>>();
  const faixasPorProduto = new Map<string, number>();
  const modelosPorProduto = new Map<string, Set<string>>();

  for (const row of compatRes.rows) {
    const produtosDoModelo = produtoIdsPorModelo.get(row.modelo_id) ?? new Set<string>();
    produtosDoModelo.add(row.produto_id);
    produtoIdsPorModelo.set(row.modelo_id, produtosDoModelo);

    faixasPorProduto.set(row.produto_id, (faixasPorProduto.get(row.produto_id) ?? 0) + 1);

    const modelosDoProduto = modelosPorProduto.get(row.produto_id) ?? new Set<string>();
    modelosDoProduto.add(row.modelo_id);
    modelosPorProduto.set(row.produto_id, modelosDoProduto);
  }

  const mapaRows = modelosRes.rows
    .map((modelo) => {
      const marca = marcasById.get(modelo.marca_id);
      const tipo = normalizeTipoVeiculoModeloFromDb(modelo.tipo_veiculo);
      return {
        marca: text(marca?.nome),
        modelo: text(modelo.nome),
        marcaSlug: text(marca?.slug),
        modeloSlug: text(modelo.slug),
        tipo: TIPO_VEICULO_MODELO_LABELS[tipo],
        qtd: produtoIdsPorModelo.get(modelo.id)?.size ?? 0,
      };
    })
    .sort((a, b) => comparePt(a.marca, b.marca) || comparePt(a.modelo, b.modelo));

  const compatRows = compatRes.rows
    .map((row) => {
      const produto = produtosById.get(row.produto_id);
      const modelo = modelosById.get(row.modelo_id);
      const marca = modelo ? marcasById.get(modelo.marca_id) : undefined;
      return {
        produtoId: row.produto_id,
        codigo: text(produto?.cod_produto),
        titulo: text(produto?.titulo),
        status: productStatusLabel(parseProductStatus(produto?.status)),
        marca: text(marca?.nome),
        modelo: text(modelo?.nome),
        marcaSlug: text(marca?.slug),
        modeloSlug: text(modelo?.slug),
        anoInicio: Number(row.ano_inicio),
        anoFim: Number(row.ano_fim),
      };
    })
    .sort(
      (a, b) =>
        comparePt(a.titulo, b.titulo) ||
        comparePt(a.marca, b.marca) ||
        comparePt(a.modelo, b.modelo) ||
        a.anoInicio - b.anoInicio
    );

  const produtoRows = produtosRes.rows
    .map((produto) => {
      const todosModelos = Boolean(produto.compat_todos_modelos);
      const qtdModelos = modelosPorProduto.get(produto.id)?.size ?? 0;
      const qtdFaixas = faixasPorProduto.get(produto.id) ?? 0;
      let acao = "sem vinculo hoje";
      if (todosModelos) acao = "manter (todos os modelos)";
      else if (qtdModelos > 0) acao = "relinkar via mapa_modelos";

      return {
        produtoId: produto.id,
        codigo: text(produto.cod_produto),
        titulo: text(produto.titulo),
        status: productStatusLabel(parseProductStatus(produto.status)),
        todosModelos,
        qtdModelos,
        qtdFaixas,
        acao,
      };
    })
    .sort((a, b) => comparePt(a.titulo, b.titulo));

  const modelosTextoPorProduto = new Map<string, string[]>();
  for (const row of compatRows) {
    const anos =
      Number.isFinite(row.anoInicio) && Number.isFinite(row.anoFim)
        ? row.anoInicio === row.anoFim
          ? String(row.anoInicio)
          : `${row.anoInicio}-${row.anoFim}`
        : "";
    const label = [row.marca, row.modelo, anos].filter(Boolean).join(" ").trim();
    if (!label) continue;
    const list = modelosTextoPorProduto.get(row.produtoId) ?? [];
    list.push(label);
    modelosTextoPorProduto.set(row.produtoId, list);
  }

  const sheets: SimpleXlsxSheet[] = [
    {
      name: "Produtos",
      headers: [
        "codigo",
        "produto",
        "status",
        "qtd_modelos",
        "modelos_compativeis",
        "acao",
        "produto_id",
      ],
      rows: produtoRows.map((row) => {
        let modelos = (modelosTextoPorProduto.get(row.produtoId) ?? []).join("; ");
        if (row.todosModelos) modelos = "Todos os modelos";
        else if (!modelos) modelos = "Sem vinculo";
        return [
          row.codigo,
          row.titulo,
          row.status,
          row.qtdModelos,
          modelos,
          row.acao,
          row.produtoId,
        ];
      }),
    },
    {
      name: "Compatibilidades",
      headers: [
        "produto_id",
        "cod_produto",
        "titulo",
        "status",
        "marca_atual",
        "modelo_atual",
        "marca_slug_atual",
        "modelo_slug_atual",
        "ano_inicio",
        "ano_fim",
      ],
      rows: compatRows.map((row) => [
        row.produtoId,
        row.codigo,
        row.titulo,
        row.status,
        row.marca,
        row.modelo,
        row.marcaSlug,
        row.modeloSlug,
        Number.isFinite(row.anoInicio) ? row.anoInicio : null,
        Number.isFinite(row.anoFim) ? row.anoFim : null,
      ]),
    },
    {
      name: "De-para modelos",
      headers: [
        "marca_atual",
        "modelo_atual",
        "marca_slug_atual",
        "modelo_slug_atual",
        "tipo_veiculo",
        "qtd_produtos",
        "marca_nova",
        "modelo_novo",
      ],
      rows: mapaRows.map((row) => [
        row.marca,
        row.modelo,
        row.marcaSlug,
        row.modeloSlug,
        row.tipo,
        row.qtd,
        "",
        "",
      ]),
    },
    {
      name: "Como usar",
      headers: ["passo", "orientacao"],
      rows: [
        ["1", "A aba Produtos lista cada peca e os carros vinculados hoje."],
        ["2", "Salve este arquivo ANTES de apagar os modelos atuais. A exclusao apaga os vinculos automaticamente."],
        ["3", "Preencha marca_nova e modelo_novo na aba De-para modelos (um de-para por modelo antigo)."],
        ["4", "A aba Compatibilidades nao precisa ser editada: guarda produto_id (estavel) e as faixas de anos."],
        ["5", "Produtos com acao \"manter (todos os modelos)\" nao precisam de relink."],
        ["6", `Gerado com ${produtosRes.rows.length} produtos, ${modelosRes.rows.length} modelos e ${compatRes.rows.length} faixas de compatibilidade.`],
      ],
    },
  ];

  return {
    ok: true,
    filename: reportFilename(),
    bytes: buildSimpleXlsx(sheets),
    contentType: XLSX_CONTENT_TYPE,
  };
}
