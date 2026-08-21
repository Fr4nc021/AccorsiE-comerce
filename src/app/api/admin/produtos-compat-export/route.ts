import { NextResponse } from "next/server";

import { buildProductCompatReport } from "@/features/produtos/services/buildProductCompatReport";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";

export const dynamic = "force-dynamic";

/**
 * Admin: backup Excel (.xlsx) dos produtos e modelos compatíveis, para relinkar após recriar o catálogo.
 */
export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const result = await buildProductCompatReport(gate.ctx.supabase);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 500 });
  }

  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
