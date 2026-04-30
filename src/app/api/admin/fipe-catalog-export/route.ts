import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { getFipeSubscriptionToken } from "@/lib/fipeSubscriptionToken";
import { buildFipeBrandExport, type FipeAnosMode } from "@/services/fipe/fipeCatalogExport";

const ANOS_MODES: FipeAnosMode[] = ["fipe", "fipe_or_range", "range", "none"];

/**
 * Admin: exporta uma marca FIPE (carros) em JSON e/ou SQL idempotente para `marcas` / `modelos` / `modelo_anos`.
 *
 * GET /api/admin/fipe-catalog-export?brandCode=59&format=json|sql|both&delayMs=400
 * &anosMode=fipe|fipe_or_range|range|none&anoDesde=1990&anoAte=2026
 *
 * - anosMode: `fipe` só API; `fipe_or_range` completa modelos sem ano com [anoDesde..anoAte];
 *   `range` aplica o intervalo a todos (sem N chamadas /modelo/years); `none` não gera modelo_anos.
 * - onlyModeloAnos=true: SQL só com INSERT em modelo_anos (marca/modelo já no banco). Opcional: marcaSlug=slug-exato-no-supabase
 * - format padrão: both (JSON no corpo com campo `sql` e `catalog`, ou use Accept / format)
 * - format=json: só o objeto catalog
 * - format=sql: text/plain com o arquivo .sql
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const token = getFipeSubscriptionToken();
  if (!token) {
    return NextResponse.json(
      { message: "Configure FIPE_SUBSCRIPTION_TOKEN no servidor para exportar a FIPE." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const brandCode = url.searchParams.get("brandCode")?.trim() ?? "";
  if (!brandCode) {
    return NextResponse.json({ message: "Parâmetro obrigatório: brandCode (código da marca na FIPE)." }, { status: 400 });
  }

  const delayMs = Math.min(2000, Math.max(0, Number(url.searchParams.get("delayMs")) || 400));
  const format = (url.searchParams.get("format") ?? "both").toLowerCase();

  const rawMode = (url.searchParams.get("anosMode") ?? "fipe").toLowerCase();
  const anosMode: FipeAnosMode = ANOS_MODES.includes(rawMode as FipeAnosMode)
    ? (rawMode as FipeAnosMode)
    : "fipe";

  const anoDesdeParam = url.searchParams.get("anoDesde");
  const anoAteParam = url.searchParams.get("anoAte");
  const anoDesde = anoDesdeParam != null && anoDesdeParam !== "" ? Number(anoDesdeParam) : undefined;
  const anoAte = anoAteParam != null && anoAteParam !== "" ? Number(anoAteParam) : undefined;

  const onlyModeloAnos =
    url.searchParams.get("onlyModeloAnos") === "1" ||
    url.searchParams.get("onlyModeloAnos")?.toLowerCase() === "true";
  const marcaSlug = url.searchParams.get("marcaSlug")?.trim() || undefined;

  const result = await buildFipeBrandExport({
    token,
    brandCode,
    delayMs,
    anosMode,
    sqlOnlyModeloAnos: onlyModeloAnos,
    ...(marcaSlug ? { marcaSlugSql: marcaSlug } : {}),
    ...(Number.isFinite(anoDesde) ? { anoDesde } : {}),
    ...(Number.isFinite(anoAte) ? { anoAte } : {}),
  });
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status && result.status >= 400 ? result.status : 502 });
  }

  if (format === "sql") {
    const suffix = onlyModeloAnos ? "solo-modelo-anos" : "seed";
    return new NextResponse(result.sql, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="fipe-marca-${brandCode}-${suffix}.sql"`,
      },
    });
  }

  if (format === "json") {
    return NextResponse.json(result.json);
  }

  return NextResponse.json({
    catalog: result.json,
    sql: result.sql,
    hint: onlyModeloAnos
      ? "SQL contém apenas INSERT em modelo_anos. Confira meta.marca_slug_sql e os slugs dos modelos no JSON (devem bater com o banco)."
      : "Use catalog para revisar dados; cole sql no Supabase SQL Editor ou salve em supabase/migrations/.",
  });
}
