import type { ProductStatus } from "@/features/produtos/utils/productStatus";

export type KitDiscountType = "percentual" | "valor_fixo" | "preco_fixo";
export type KitStatus = ProductStatus;

export type KitItemInput = {
  product_id: string;
  quantidade: number;
};

export type KitSummary = {
  id: string;
  slug: string;
  nome: string;
  imagem: string | null;
  precoNormal: number;
  precoKit: number;
  economia: number;
  itemCount: number;
};

export type KitDetailItem = {
  product_id: string;
  quantidade: number;
  titulo: string;
  cod_produto: string;
  valor: number;
  imageUrl: string | null;
  quantidade_estoque: number;
  desconto_pix_percent: number;
  desconto_cartao_percent: number;
  somente_retirada_loja: boolean;
};

export type KitDetail = KitSummary & {
  descricao: string;
  seo_title: string | null;
  seo_description: string | null;
  tipo_desconto: KitDiscountType;
  valor_desconto: number;
  preco_final: number | null;
  status: KitStatus;
  items: KitDetailItem[];
};
