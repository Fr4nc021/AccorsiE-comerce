export type ProductPublishFields = {
  titulo: string | null | undefined;
  cod_produto: string | null | undefined;
  valor: number | null | undefined;
  quantidade_estoque: number | null | undefined;
  prod_comprimento_cm: number | null | undefined;
  prod_largura_cm: number | null | undefined;
  prod_altura_cm: number | null | undefined;
  prod_peso_kg: number | null | undefined;
};

const FIELD_LABELS = {
  titulo: "Título",
  cod_produto: "Código do produto",
  valor: "Valor (R$)",
  quantidade_estoque: "Quantidade em estoque",
  prod_comprimento_cm: "Comprimento (cm)",
  prod_largura_cm: "Largura (cm)",
  prod_altura_cm: "Altura (cm)",
  prod_peso_kg: "Peso (kg)",
} as const;

function isFilledText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function isValidNonNegNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidNonNegInt(value: number | null | undefined): boolean {
  return isValidNonNegNumber(value) && Number.isInteger(value);
}

/** Returns human-readable pending field labels required to publish. */
export function getPendingPublishFields(fields: ProductPublishFields): string[] {
  const pending: string[] = [];

  if (!isFilledText(fields.titulo)) pending.push(FIELD_LABELS.titulo);
  if (!isFilledText(fields.cod_produto)) pending.push(FIELD_LABELS.cod_produto);
  if (!isValidNonNegNumber(fields.valor)) pending.push(FIELD_LABELS.valor);
  if (!isValidNonNegInt(fields.quantidade_estoque)) pending.push(FIELD_LABELS.quantidade_estoque);
  if (!isValidNonNegNumber(fields.prod_comprimento_cm)) pending.push(FIELD_LABELS.prod_comprimento_cm);
  if (!isValidNonNegNumber(fields.prod_largura_cm)) pending.push(FIELD_LABELS.prod_largura_cm);
  if (!isValidNonNegNumber(fields.prod_altura_cm)) pending.push(FIELD_LABELS.prod_altura_cm);
  if (!isValidNonNegNumber(fields.prod_peso_kg)) pending.push(FIELD_LABELS.prod_peso_kg);

  return pending;
}

export function validateProductForPublish(
  fields: ProductPublishFields
): { ok: true } | { ok: false; pending: string[]; message: string } {
  const pending = getPendingPublishFields(fields);
  if (pending.length === 0) return { ok: true };

  return {
    ok: false,
    pending,
    message: `Não é possível publicar. Campos pendentes: ${pending.join(", ")}.`,
  };
}

export function formatPendingPublishMessage(pending: string[]): string {
  return `Não é possível publicar. Campos pendentes: ${pending.join(", ")}.`;
}
