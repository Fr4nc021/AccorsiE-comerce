"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/services/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CupomTipoRow = "percent" | "fixed";

export type CreateCupomState = { ok: false; message: string } | null;

export type SaveCupomResult = { ok: true } | { ok: false; message: string };

function parseValorPercent(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

function parseValorFixed(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function parseMaxUsos(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseValidoAte(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function createCupom(_prev: CreateCupomState, formData: FormData): Promise<CreateCupomState> {
  await requireAdmin();
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const tipo = String(formData.get("tipo") ?? "").trim() as CupomTipoRow;
  const valorRaw = String(formData.get("valor") ?? "");
  const ativo = formData.get("ativo") != null;
  const validoAteIso = parseValidoAte(String(formData.get("valido_ate") ?? ""));
  const maxUsos = parseMaxUsos(String(formData.get("max_usos") ?? ""));

  if (!codigo || codigo.length < 2) {
    return { ok: false, message: "Informe um código de cupom (ao menos 2 caracteres)." };
  }
  if (tipo !== "percent" && tipo !== "fixed") {
    return { ok: false, message: "Tipo de desconto inválido." };
  }

  const valor = tipo === "percent" ? parseValorPercent(valorRaw) : parseValorFixed(valorRaw);
  if (valor == null) {
    return {
      ok: false,
      message:
        tipo === "percent"
          ? "Para porcentagem, use um número entre 0 e 100."
          : "Para valor fixo, informe um valor em reais maior que zero.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cupons").insert({
    codigo,
    tipo,
    valor,
    ativo,
    valido_ate: validoAteIso,
    max_usos: maxUsos,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Já existe um cupom com esse código." };
    }
    return { ok: false, message: error.message || "Não foi possível salvar." };
  }

  revalidatePath("/admin/cupons");
  redirect("/admin/cupons?cadastrado=1");
}

export async function updateCupom(formData: FormData): Promise<SaveCupomResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const tipo = String(formData.get("tipo") ?? "").trim() as CupomTipoRow;
  const valorRaw = String(formData.get("valor") ?? "");
  const ativo = formData.get("ativo") != null;
  const validoAteIso = parseValidoAte(String(formData.get("valido_ate") ?? ""));
  const maxUsos = parseMaxUsos(String(formData.get("max_usos") ?? ""));

  if (!id) {
    return { ok: false, message: "Cupom inválido." };
  }
  if (!codigo || codigo.length < 2) {
    return { ok: false, message: "Informe um código de cupom." };
  }
  if (tipo !== "percent" && tipo !== "fixed") {
    return { ok: false, message: "Tipo de desconto inválido." };
  }

  const valor = tipo === "percent" ? parseValorPercent(valorRaw) : parseValorFixed(valorRaw);
  if (valor == null) {
    return {
      ok: false,
      message:
        tipo === "percent"
          ? "Para porcentagem, use um número entre 0 e 100."
          : "Para valor fixo, informe um valor em reais maior que zero.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cupons")
    .update({
      codigo,
      tipo,
      valor,
      ativo,
      valido_ate: validoAteIso,
      max_usos: maxUsos,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Já existe outro cupom com esse código." };
    }
    return { ok: false, message: error.message || "Não foi possível salvar." };
  }

  revalidatePath("/admin/cupons");
  return { ok: true };
}

export type DeleteCupomResult = { ok: true } | { ok: false; message: string };

export async function deleteCupom(cupomId: string): Promise<DeleteCupomResult> {
  await requireAdmin();
  const id = cupomId.trim();
  if (!id) {
    return { ok: false, message: "Cupom inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cupons").delete().eq("id", id);

  if (error) {
    return { ok: false, message: error.message || "Não foi possível excluir." };
  }

  revalidatePath("/admin/cupons");
  return { ok: true };
}
