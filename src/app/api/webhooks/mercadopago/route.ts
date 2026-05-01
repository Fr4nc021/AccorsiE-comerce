import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { sendPedidoTransactionalEmail } from "@/services/email/transactionalPedidoEmail";
import { createAdminClient } from "@/services/supabase/admin";
import { mercadoPagoAmountMatchesPedidoTotal } from "@/services/mercadopago/amountsMatch";
import { getPayment } from "@/services/mercadopago/client";

export const dynamic = "force-dynamic";

type ParsedNotification = {
  topic: string;
  paymentId: string;
  /** Valor usado no manifest da assinatura (query `data.id` ou fallback). */
  manifestDataId: string;
};

function parseMpSignatureHeader(xSignature: string | null): { ts: string; v1: string } | null {
  if (!xSignature) return null;
  const parts = xSignature.split(",");
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  if (!ts || !v1) return null;
  return { ts, v1 };
}

function buildMpSignatureManifest(dataId: string, requestId: string | null, ts: string): string {
  const idNorm = dataId.trim().toLowerCase();
  const rid = requestId?.trim();
  const ridPart = rid ? `request-id:${rid};` : "";
  return `id:${idNorm};${ridPart}ts:${ts};`;
}

function verifyMercadoPagoWebhookSignature(opts: {
  secret: string;
  manifestDataId: string;
  requestId: string | null;
  ts: string;
  v1: string;
}): boolean {
  const manifest = buildMpSignatureManifest(opts.manifestDataId, opts.requestId, opts.ts);
  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  try {
    if (expected.length !== opts.v1.length) return false;
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(opts.v1, "utf8"));
  } catch {
    return false;
  }
}

function tsWithinTolerance(tsRaw: string, toleranceMs: number): boolean {
  const n = Number(tsRaw);
  if (!Number.isFinite(n)) return false;
  const tsMs = n < 1e12 ? n * 1000 : n;
  return Math.abs(Date.now() - tsMs) <= toleranceMs;
}

function readBodyPaymentId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const o = body as Record<string, unknown>;
  const data = o.data;
  if (typeof data === "object" && data !== null && "id" in data) {
    const id = (data as { id?: unknown }).id;
    if (id !== undefined && id !== null && String(id).trim() !== "") {
      return String(id).trim();
    }
  }
  return null;
}

function readBodyTopic(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const o = body as Record<string, unknown>;
  if (typeof o.type === "string") return o.type;
  if (typeof o.topic === "string") return o.topic;
  return "";
}

function parsePaymentNotification(
  url: URL,
  body: unknown,
  form?: URLSearchParams | null,
): ParsedNotification | null {
  const sp = url.searchParams;
  const qDataId = sp.get("data.id")?.trim() || "";
  const qType = (sp.get("type") ?? "").trim();

  const formTopic = form?.get("topic")?.trim() ?? "";
  const formId = form?.get("id")?.trim() ?? "";
  const formDataId = form?.get("data.id")?.trim() ?? "";
  if (formTopic === "payment" && formId) {
    return {
      topic: "payment",
      paymentId: formId,
      manifestDataId: formDataId || formId,
    };
  }

  const legacyTopic = (sp.get("topic") ?? "").trim();
  const legacyId = sp.get("id")?.trim();
  if (legacyTopic === "payment" && legacyId) {
    return { topic: "payment", paymentId: legacyId, manifestDataId: qDataId || legacyId };
  }

  const bodyPid = readBodyPaymentId(body);
  const bodyTopic = readBodyTopic(body);

  if (bodyPid && (bodyTopic === "payment" || bodyTopic === "")) {
    return {
      topic: "payment",
      paymentId: bodyPid,
      manifestDataId: qDataId || bodyPid,
    };
  }

  if (qType === "payment" && qDataId) {
    return { topic: "payment", paymentId: qDataId, manifestDataId: qDataId };
  }

  return null;
}

export async function POST(request: Request) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !secret) {
    return NextResponse.json(
      { message: "MERCADOPAGO_WEBHOOK_SECRET é obrigatório em produção." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const rawText = await request.text();
  const contentType = request.headers.get("content-type") ?? "";
  let body: unknown = null;
  let formParams: URLSearchParams | null = null;

  if (rawText.trim()) {
    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(rawText) as unknown;
      } catch {
        return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      formParams = new URLSearchParams(rawText);
    } else {
      try {
        body = JSON.parse(rawText) as unknown;
      } catch {
        formParams = new URLSearchParams(rawText);
      }
    }
  }

  if (secret) {
    const xSignature = request.headers.get("x-signature");
    const parsed = parseMpSignatureHeader(xSignature);
    if (!parsed) {
      return NextResponse.json({ message: "Assinatura ausente ou inválida." }, { status: 401 });
    }
    if (!tsWithinTolerance(parsed.ts, 10 * 60 * 1000)) {
      return NextResponse.json({ message: "Timestamp fora da tolerância." }, { status: 401 });
    }
    const notification = parsePaymentNotification(url, body, formParams);
    const manifestDataId =
      notification?.manifestDataId ??
      url.searchParams.get("data.id")?.trim() ??
      formParams?.get("data.id")?.trim() ??
      "";
    if (!manifestDataId) {
      return NextResponse.json({ message: "data.id ausente para validação." }, { status: 401 });
    }
    const okSig = verifyMercadoPagoWebhookSignature({
      secret,
      manifestDataId,
      requestId: request.headers.get("x-request-id"),
      ts: parsed.ts,
      v1: parsed.v1,
    });
    if (!okSig) {
      return NextResponse.json({ message: "Assinatura não confere." }, { status: 401 });
    }
  }

  const notification = parsePaymentNotification(url, body, formParams);
  if (!notification) {
    const topicHint =
      readBodyTopic(body) ||
      url.searchParams.get("topic") ||
      url.searchParams.get("type") ||
      formParams?.get("topic");
    if (topicHint && topicHint !== "payment") {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return NextResponse.json({ message: "Servidor sem MERCADOPAGO_ACCESS_TOKEN." }, { status: 503 });
  }

  const mp = await getPayment(notification.paymentId, { accessToken });
  if (!mp.ok) {
    if (mp.status === 404) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }
    return NextResponse.json({ message: `MP: ${mp.detail}` }, { status: 502 });
  }

  const payment = mp.payment;
  const status = typeof payment.status === "string" ? payment.status : "";
  const extRef = payment.external_reference?.trim() ?? "";
  if (!extRef) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(extRef)) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  if (payment.currency_id && payment.currency_id !== "BRL") {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuração do servidor incompleta.";
    return NextResponse.json({ message: msg }, { status: 503 });
  }

  const { data: pedido, error: pedidoError } = await admin
    .from("pedidos")
    .select("id, total")
    .eq("id", extRef)
    .maybeSingle();

  if (pedidoError || !pedido) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const txAmount = payment.transaction_amount;
  if (typeof txAmount !== "number" || !Number.isFinite(txAmount)) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  if (!mercadoPagoAmountMatchesPedidoTotal(txAmount, pedido.total)) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const paymentIdStr = String(payment.id ?? notification.paymentId);

  const { data: rpcResult, error: rpcError } = await admin.rpc("mercadopago_aplicar_estado_pagamento", {
    p_pedido_id: extRef,
    p_mp_payment_id: paymentIdStr,
    p_mp_status: status,
  });

  if (rpcError) {
    return NextResponse.json({ message: rpcError.message }, { status: 500 });
  }

  const row = rpcResult as { ok?: boolean; error?: string } | null;
  if (row && row.ok === false && row.error === "estoque_insuficiente") {
    return NextResponse.json({ ok: false, error: "estoque_insuficiente" }, { status: 200 });
  }

  if (status === "approved") {
    try {
      const { data: pedidoCliente } = await admin
        .from("pedidos")
        .select("user_id, total")
        .eq("id", extRef)
        .maybeSingle();

      if (pedidoCliente?.user_id) {
        const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(
          pedidoCliente.user_id,
        );
        if (!authErr && authUser?.user) {
          await sendPedidoTransactionalEmail(admin, {
            pedidoId: extRef,
            kind: "pagamento_confirmado",
            toEmail: authUser.user.email,
            total: pedidoCliente.total as string | number,
          });
        }
      }
    } catch (e) {
      console.error("[email] pagamento confirmado:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, result: rpcResult ?? null }, { status: 200 });
}
