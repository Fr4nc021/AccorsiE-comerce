import { computeKitPricing, parseKitDiscountType } from "@/features/kits/utils/kitPricing";
import { resolveProductImagePublicUrl } from "@/features/produtos/utils/resolveProductImagePublicUrl";
import { clampPercent } from "@/features/produtos/utils/paymentDiscount";
import type { KitDetail, KitDetailItem, KitSummary } from "@/types/kit";
import { parseKitStatus } from "@/features/kits/utils/kitStatus";

type ProdutoEmbed = {
  id: string;
  titulo: string | null;
  cod_produto: string | null;
  valor: number | string | null;
  foto: string | null;
  quantidade_estoque: number | null;
  desconto_pix_percent?: number | null;
  desconto_cartao_percent?: number | null;
  somente_retirada_loja?: boolean | null;
  status?: string | null;
};

type KitItemEmbed = {
  quantidade: number;
  product_id: string;
  produtos?: ProdutoEmbed | ProdutoEmbed[] | null;
};

export type KitRowWithItems = {
  id: string;
  nome: string | null;
  slug: string | null;
  descricao?: string | null;
  imagem: string | null;
  tipo_desconto: string | null;
  valor_desconto: number | string | null;
  preco_final: number | string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  status?: string | null;
  kit_items?: KitItemEmbed[] | null;
};

function embedProduto(raw: KitItemEmbed["produtos"]): ProdutoEmbed | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export function mapKitItems(rows: KitItemEmbed[] | null | undefined): KitDetailItem[] {
  const items: KitDetailItem[] = [];
  for (const row of rows ?? []) {
    const p = embedProduto(row.produtos);
    if (!p?.id) continue;
    if (p.status && p.status !== "published") continue;
    const valor = Number(p.valor);
    if (!Number.isFinite(valor)) continue;
    items.push({
      product_id: p.id,
      quantidade: Math.max(1, Number(row.quantidade) || 1),
      titulo: (p.titulo ?? "").trim() || "Produto",
      cod_produto: (p.cod_produto ?? "").trim() || "—",
      valor,
      imageUrl: resolveProductImagePublicUrl(p.foto),
      quantidade_estoque: Math.max(0, Math.floor(Number(p.quantidade_estoque) || 0)),
      desconto_pix_percent: clampPercent(p.desconto_pix_percent ?? 0),
      desconto_cartao_percent: clampPercent(p.desconto_cartao_percent ?? 0),
      somente_retirada_loja: p.somente_retirada_loja === true,
    });
  }
  return items;
}

export function mapKitSummary(row: KitRowWithItems): KitSummary | null {
  if (!row.slug?.trim() || !row.nome?.trim()) return null;
  const items = mapKitItems(row.kit_items);
  const pricing = computeKitPricing({
    tipo_desconto: parseKitDiscountType(row.tipo_desconto),
    valor_desconto: Number(row.valor_desconto) || 0,
    preco_final: row.preco_final != null ? Number(row.preco_final) : null,
    items: items.map((it) => ({ valor: it.valor, quantidade: it.quantidade })),
  });
  return {
    id: row.id,
    slug: row.slug.trim(),
    nome: row.nome.trim(),
    imagem: row.imagem ? resolveProductImagePublicUrl(row.imagem) : null,
    precoNormal: pricing.precoNormal,
    precoKit: pricing.precoKit,
    economia: pricing.economia,
    itemCount: items.length,
  };
}

export function mapKitDetail(row: KitRowWithItems): KitDetail | null {
  const summary = mapKitSummary(row);
  if (!summary) return null;
  const items = mapKitItems(row.kit_items);
  return {
    ...summary,
    descricao: (row.descricao ?? "").trim(),
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
    tipo_desconto: parseKitDiscountType(row.tipo_desconto),
    valor_desconto: Number(row.valor_desconto) || 0,
    preco_final: row.preco_final != null ? Number(row.preco_final) : null,
    status: parseKitStatus(row.status),
    items,
  };
}

export const KIT_LIST_SELECT = `
  id, nome, slug, descricao, imagem, tipo_desconto, valor_desconto, preco_final, status,
  kit_items ( quantidade, product_id, produtos ( id, titulo, cod_produto, valor, foto, quantidade_estoque, desconto_pix_percent, desconto_cartao_percent, somente_retirada_loja, status ) )
` as const;

export const KIT_DETAIL_SELECT = `
  id, nome, slug, descricao, imagem, tipo_desconto, valor_desconto, preco_final,
  seo_title, seo_description, status,
  kit_items ( quantidade, product_id, produtos ( id, titulo, cod_produto, valor, foto, quantidade_estoque, desconto_pix_percent, desconto_cartao_percent, somente_retirada_loja, status ) )
` as const;
