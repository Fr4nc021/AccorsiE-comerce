/** Dados mínimos do produto para cards na vitrine (home). */
export type ProductSummary = {
  id: string;
  titulo: string;
  cod_produto: string;
  valor: number;
  imageUrl: string | null;
};
