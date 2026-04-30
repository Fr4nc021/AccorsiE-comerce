import { NextResponse } from "next/server";

import { getFipeSubscriptionToken } from "@/lib/fipeSubscriptionToken";
import { fetchParallelumJson, resolveParallelumGetUrl } from "@/services/fipe/parallelumClient";

/**
 * Proxy somente leitura para a API FIPE v2 (Parallelum). A chave fica no servidor (FIPE_SUBSCRIPTION_TOKEN).
 *
 * Caminhos suportados (GET):
 * - /api/fipe/references
 * - /api/fipe/cars/brands
 * - /api/fipe/cars/brands/{brandCode}/models
 * - /api/fipe/cars/brands/{brandCode}/models/{modelCode}/years
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const token = getFipeSubscriptionToken();
  if (!token) {
    return NextResponse.json(
      { message: "Configure FIPE_SUBSCRIPTION_TOKEN no servidor para consultar a FIPE." },
      { status: 503 },
    );
  }

  const { path: rawPath } = await context.params;
  const segments = rawPath ?? [];
  const upstream = resolveParallelumGetUrl(segments);
  if (!upstream) {
    return NextResponse.json(
      {
        message:
          "Caminho inválido. Use: /api/fipe/references, /api/fipe/cars/brands, /api/fipe/cars/brands/{code}/models ou .../models/{code}/years.",
      },
      { status: 400 },
    );
  }

  const result = await fetchParallelumJson(upstream, token);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status >= 400 ? result.status : 502 });
  }

  return NextResponse.json(result.data);
}
