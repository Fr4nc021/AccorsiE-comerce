import {
  allocateSlug,
  escapeSqlString,
  extractYearFromFipeYearEntry,
  slugifyMarca,
  slugifyModelo,
} from "@/services/fipe/fipeSlugs";
import { fetchParallelumJsonWithRetry, resolveParallelumGetUrl } from "@/services/fipe/parallelumClient";

export type FipeCatalogModeloJson = {
  nome: string;
  slug: string;
  fipe_model_code: string;
  anos: number[];
};

export type FipeAnosMode = "fipe" | "fipe_or_range" | "range" | "none";

export type FipeCatalogExportJson = {
  meta: {
    source: "parallelum-fipe-v2";
    tipo_veiculo: "carro";
    brand_fipe_code: string;
    generated_at: string;
    anos_mode: FipeAnosMode;
    ano_interval?: { desde: number; ate: number };
    sql_scope: "full" | "modelo_anos_only";
    /** Quando informado no export cirúrgico: slug da marca usado no SQL (WHERE ma.slug). */
    marca_slug_sql?: string;
  };
  marca: { nome: string; slug: string; fipe_code: string };
  modelos: FipeCatalogModeloJson[];
};

function fipeItem(raw: unknown): { code: string; nome: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = o.code ?? o.codigo;
  const nome = o.name ?? o.nome;
  if (code == null) return null;
  const nomeStr = String(nome ?? "").trim();
  if (!nomeStr) return null;
  return { code: String(code), nome: nomeStr };
}

function listFromPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const inner = o.models ?? o.modelos;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

/** Resposta do GET .../years pode vir como array ou objeto com `years` / `anos` / `data`. */
function yearsArrayFromPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const inner = o.years ?? o.anos ?? o.data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

function clampYear(y: number): number {
  return Math.min(2100, Math.max(1900, Math.round(y)));
}

function integerYearRangeIncl(desde: number, ate: number): number[] {
  const lo = clampYear(Math.min(desde, ate));
  const hi = clampYear(Math.max(desde, ate));
  const out: number[] = [];
  for (let y = lo; y <= hi; y++) out.push(y);
  return out;
}

export type FipeBrandExportResult =
  | { ok: true; json: FipeCatalogExportJson; sql: string }
  | { ok: false; message: string; status?: number };

/**
 * Para uma marca FIPE (carros): busca modelos e anos e monta JSON + SQL idempotente (mesmo padrão do seed `generate-fipe-carros-seed.mjs`).
 *
 * - `fipe`: só anos retornados pela API (com parsing tolerante).
 * - `fipe_or_range`: usa FIPE; se um modelo vier sem ano, preenche com [anoDesde..anoAte].
 * - `range`: ignora chamadas por modelo à FIPE; grava o mesmo intervalo para todos (rápido, bom para massa).
 * - `none`: só marcas/modelos; sem `modelo_anos` (compatibilidade de produto exigirá anos depois).
 *
 * `sqlOnlyModeloAnos`: gera SQL **apenas** com `INSERT INTO modelo_anos` (marca/modelo já existentes).
 * `marcaSlugSql`: opcional; slug da marca **no banco** para o `WHERE ma.slug = ...` (se diferente do slug calculado).
 */
export async function buildFipeBrandExport(opts: {
  token: string;
  brandCode: string;
  delayMs?: number;
  anosMode?: FipeAnosMode;
  anoDesde?: number;
  anoAte?: number;
  sqlOnlyModeloAnos?: boolean;
  marcaSlugSql?: string;
}): Promise<FipeBrandExportResult> {
  const delayMs = opts.delayMs ?? 400;
  const brandCode = opts.brandCode.trim();
  const anosMode: FipeAnosMode = opts.anosMode ?? "fipe";
  const currentYear = new Date().getFullYear();
  let anoDesde = clampYear(opts.anoDesde ?? 1990);
  let anoAte = clampYear(opts.anoAte ?? currentYear);
  if (anoDesde > anoAte) [anoDesde, anoAte] = [anoAte, anoDesde];
  const rangeYears = integerYearRangeIncl(anoDesde, anoAte);
  const sqlOnlyModeloAnos = opts.sqlOnlyModeloAnos === true;
  if (sqlOnlyModeloAnos && anosMode === "none") {
    return {
      ok: false,
      message: "Export só modelo_anos exige anosMode diferente de «none» (ex.: range ou fipe_or_range).",
    };
  }
  if (!brandCode) {
    return { ok: false, message: "brandCode obrigatório." };
  }

  const brandsUrl = resolveParallelumGetUrl(["cars", "brands"]);
  if (!brandsUrl) return { ok: false, message: "URL de marcas inválida." };

  const brandsRes = await fetchParallelumJsonWithRetry(brandsUrl, opts.token, { delayMs });
  if (!brandsRes.ok) {
    return { ok: false, message: brandsRes.message, status: brandsRes.status };
  }

  const brandRows = Array.isArray(brandsRes.data) ? brandsRes.data : [];
  const match = brandRows
    .map(fipeItem)
    .filter((b): b is NonNullable<typeof b> => b != null)
    .find((b) => String(b.code) === String(brandCode));
  if (!match) {
    return { ok: false, message: `Marca com código FIPE "${brandCode}" não encontrada na lista de marcas.` };
  }

  const nomeMarca = match.nome;
  const usedMarcaSlugs = new Set<string>();
  const slugMarca = allocateSlug(slugifyMarca(nomeMarca), usedMarcaSlugs);
  const marcaSlugForSql = (opts.marcaSlugSql?.trim() || slugMarca).trim();
  const usedModelSlugs = new Set<string>();

  const modelsUrl = resolveParallelumGetUrl(["cars", "brands", brandCode, "models"]);
  if (!modelsUrl) return { ok: false, message: "URL de modelos inválida." };

  const modelsRes = await fetchParallelumJsonWithRetry(modelsUrl, opts.token, { delayMs });
  if (!modelsRes.ok) {
    return { ok: false, message: modelsRes.message, status: modelsRes.status };
  }

  const modelosList = listFromPayload(modelsRes.data).map(fipeItem).filter(Boolean) as {
    code: string;
    nome: string;
  }[];

  const jsonModelos: FipeCatalogModeloJson[] = [];
  const sqlLines: string[] = sqlOnlyModeloAnos
    ? [
        "-- ============================================================================",
        "-- SOMENTE public.modelo_anos (idempotente, ON CONFLICT DO NOTHING).",
        "-- Pré-requisito: public.marcas e public.modelos já existem.",
        "-- Os slugs de modelo abaixo seguem a mesma regra do export FIPE (ordem da lista).",
        `-- Marca FIPE: ${escapeSqlString(nomeMarca)} (code ${brandCode})`,
        `-- Slug da marca no SQL: '${escapeSqlString(marcaSlugForSql)}'`,
        opts.marcaSlugSql?.trim()
          ? `-- (override: slug calculado seria '${escapeSqlString(slugMarca)}')`
          : "",
        `-- Gerado em: ${new Date().toISOString()}`,
        `-- Modo de anos: ${anosMode}` +
          (anosMode === "range" || anosMode === "fipe_or_range"
            ? `; intervalo ${anoDesde}–${anoAte} quando aplicável`
            : ""),
        "-- ============================================================================",
        "BEGIN;",
        "",
      ].filter((line) => line !== "")
    : [
        "-- ============================================================================",
        "-- Gerado para Supabase: marcas / modelos / modelo_anos (idempotente).",
        "-- Fonte: API FIPE v2 Parallelum — uma marca (carros).",
        `-- Marca FIPE: ${escapeSqlString(nomeMarca)} (code ${brandCode})`,
        `-- Gerado em: ${new Date().toISOString()}`,
        `-- Modo de anos: ${anosMode}` +
          (anosMode === "none"
            ? " (sem modelo_anos)"
            : anosMode === "range" || anosMode === "fipe_or_range"
              ? `; intervalo fallback ${anoDesde}–${anoAte}`
              : ""),
        "-- Cole no SQL Editor ou salve como migration em supabase/migrations/.",
        "-- ============================================================================",
        "BEGIN;",
        "",
        `INSERT INTO public.marcas (nome, slug) VALUES ('${escapeSqlString(nomeMarca)}', '${escapeSqlString(slugMarca)}') ON CONFLICT (slug) DO NOTHING;`,
      ];

  for (const mod of modelosList) {
    const slugModelo = allocateSlug(slugifyModelo(mod.nome), usedModelSlugs);
    const years = new Set<number>();

    if (anosMode === "range") {
      for (const y of rangeYears) years.add(y);
    } else if (anosMode !== "none") {
      const yearsUrl = resolveParallelumGetUrl(["cars", "brands", brandCode, "models", mod.code, "years"]);
      if (yearsUrl) {
        const yearsRes = await fetchParallelumJsonWithRetry(yearsUrl, opts.token, { delayMs });
        if (yearsRes.ok) {
          for (const a of yearsArrayFromPayload(yearsRes.data)) {
            const y = extractYearFromFipeYearEntry(a);
            if (y != null) years.add(y);
          }
        }
      }
      if (anosMode === "fipe_or_range" && years.size === 0) {
        for (const y of rangeYears) years.add(y);
      }
    }

    const anos = [...years].sort((a, b) => a - b);
    jsonModelos.push({
      nome: mod.nome,
      slug: slugModelo,
      fipe_model_code: mod.code,
      anos,
    });

    if (!sqlOnlyModeloAnos) {
      sqlLines.push(
        `INSERT INTO public.modelos (marca_id, nome, slug, tipo_veiculo) SELECT m.id, '${escapeSqlString(mod.nome)}', '${escapeSqlString(slugModelo)}', 'carro' FROM public.marcas m WHERE m.slug = '${escapeSqlString(slugMarca)}' ON CONFLICT (marca_id, slug) DO NOTHING;`,
      );
    }
    if (anosMode !== "none") {
      const marcaSlugInAnos = sqlOnlyModeloAnos ? marcaSlugForSql : slugMarca;
      for (const ano of anos) {
        sqlLines.push(
          `INSERT INTO public.modelo_anos (modelo_id, ano) SELECT mo.id, ${ano}::smallint FROM public.modelos mo INNER JOIN public.marcas ma ON ma.id = mo.marca_id WHERE ma.slug = '${escapeSqlString(marcaSlugInAnos)}' AND mo.slug = '${escapeSqlString(slugModelo)}' ON CONFLICT (modelo_id, ano) DO NOTHING;`,
        );
      }
    }
  }

  sqlLines.push("", "COMMIT;");

  const json: FipeCatalogExportJson = {
    meta: {
      source: "parallelum-fipe-v2",
      tipo_veiculo: "carro",
      brand_fipe_code: brandCode,
      generated_at: new Date().toISOString(),
      anos_mode: anosMode,
      sql_scope: sqlOnlyModeloAnos ? "modelo_anos_only" : "full",
      ...(sqlOnlyModeloAnos || opts.marcaSlugSql?.trim()
        ? { marca_slug_sql: marcaSlugForSql }
        : {}),
      ...(anosMode === "none" ? {} : { ano_interval: { desde: anoDesde, ate: anoAte } }),
    },
    marca: { nome: nomeMarca, slug: slugMarca, fipe_code: brandCode },
    modelos: jsonModelos,
  };

  return { ok: true, json, sql: sqlLines.join("\n") };
}
