"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { classifyTipoVeiculoModelo } from "@/services/fipe/classifyTipoVeiculoModelo";
import { allocateSlug, slugifyMarca, slugifyModelo } from "@/services/fipe/fipeSlugs";
import type { FipeVehicleType } from "@/services/fipe/parallelumClient";
import { isFipeVehicleType } from "@/services/fipe/parallelumClient";
import { createClient } from "@/services/supabase/server";

const MODELO_CHUNK = 80;
const ANO_CHUNK = 400;
const MAX_MODELOS = 1500;
const MAX_ANOS_POR_MODELO = 150;
const ANO_MIN = 1900;
const ANO_MAX = 2100;

export type ImportFipeBrandInput = {
  marcaNome: string;
  vehicleType: FipeVehicleType;
  modelos: { nome: string; anos: number[] }[];
};

export type ImportFipeBrandResult =
  | {
      ok: true;
      marca: { nome: string; slug: string; status: "created" | "existing" };
      modelosNovos: number;
      modelosExistentes: number;
      anosInseridos: number;
      tipoFonte: FipeVehicleType;
    }
  | { ok: false; message: string };

type MarcaRow = { id: string; nome: string; slug: string };
type ModeloRow = { id: string; nome: string; slug: string };

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function normalizeNomeKey(nome: string): string {
  return nome.trim().toLowerCase();
}

function sanitizeAnos(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const years = new Set<number>();
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number.parseInt(String(item), 10);
    if (!Number.isInteger(n) || n < ANO_MIN || n > ANO_MAX) continue;
    years.add(n);
    if (years.size >= MAX_ANOS_POR_MODELO) break;
  }
  return [...years].sort((a, b) => a - b);
}

async function allocateUniqueMarcaSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseRaw: string,
): Promise<string> {
  const used = new Set<string>();
  const base = slugifyMarca(baseRaw);
  let candidate = base;
  let n = 2;
  for (;;) {
    if (!used.has(candidate)) {
      const { data } = await supabase.from("marcas").select("id").eq("slug", candidate).maybeSingle();
      if (!data) return candidate;
      used.add(candidate);
    }
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 200) return `${base}-${Date.now()}`;
  }
}

async function findMarca(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nome: string,
  slugGuess: string,
): Promise<MarcaRow | null> {
  const { data: bySlug } = await supabase
    .from("marcas")
    .select("id, nome, slug")
    .eq("slug", slugGuess)
    .maybeSingle();
  if (bySlug) return bySlug as MarcaRow;

  const { data: byNome } = await supabase.from("marcas").select("id, nome, slug").eq("nome", nome).maybeSingle();
  if (byNome) return byNome as MarcaRow;

  const { data: byNomeIlike } = await supabase
    .from("marcas")
    .select("id, nome, slug")
    .ilike("nome", nome.replace(/[%_]/g, ""))
    .maybeSingle();
  return (byNomeIlike as MarcaRow | null) ?? null;
}

async function findOrCreateMarca(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nome: string,
): Promise<{ row: MarcaRow; status: "created" | "existing" } | { ok: false; message: string }> {
  const slugGuess = slugifyMarca(nome);
  const existing = await findMarca(supabase, nome, slugGuess);
  if (existing) return { row: existing, status: "existing" };

  const slug = await allocateUniqueMarcaSlug(supabase, nome);
  const { data, error } = await supabase.from("marcas").insert({ nome, slug }).select("id, nome, slug").single();

  if (!error && data) return { row: data as MarcaRow, status: "created" };

  if (error?.code === "23505") {
    const again = await findMarca(supabase, nome, slug);
    if (again) return { row: again, status: "existing" };
    const byGuess = await findMarca(supabase, nome, slugGuess);
    if (byGuess) return { row: byGuess, status: "existing" };
  }

  return {
    ok: false,
    message: error?.message ? `Não foi possível salvar a marca: ${error.message}.` : "Não foi possível salvar a marca.",
  };
}

export async function importFipeBrand(input: ImportFipeBrandInput): Promise<ImportFipeBrandResult> {
  await requireAdmin();

  const marcaNome = String(input?.marcaNome ?? "").trim();
  const vehicleType = input?.vehicleType;
  if (!marcaNome) {
    return { ok: false, message: "Informe o nome da marca." };
  }
  if (!isFipeVehicleType(String(vehicleType ?? ""))) {
    return { ok: false, message: "Tipo de veículo FIPE inválido (use carros ou caminhões)." };
  }

  const rawModelos = Array.isArray(input?.modelos) ? input.modelos : [];
  if (rawModelos.length === 0) {
    return { ok: false, message: "Nenhum modelo para importar. Carregue a marca na consulta FIPE primeiro." };
  }
  if (rawModelos.length > MAX_MODELOS) {
    return { ok: false, message: `Muitos modelos de uma vez (máx. ${MAX_MODELOS}).` };
  }

  const modelosPayload: { nome: string; anos: number[] }[] = [];
  const seenNome = new Set<string>();
  for (const row of rawModelos) {
    const nome = String(row?.nome ?? "").trim();
    if (!nome) continue;
    const key = normalizeNomeKey(nome);
    if (seenNome.has(key)) continue;
    seenNome.add(key);
    modelosPayload.push({ nome, anos: sanitizeAnos(row?.anos) });
  }
  if (modelosPayload.length === 0) {
    return { ok: false, message: "Nenhum modelo válido para importar." };
  }

  const supabase = await createClient();
  const marcaRes = await findOrCreateMarca(supabase, marcaNome);
  if ("ok" in marcaRes) return marcaRes;

  const marca = marcaRes.row;
  const marcaStatus = marcaRes.status;

  const { data: existentesRaw, error: existentesErr } = await supabase
    .from("modelos")
    .select("id, nome, slug")
    .eq("marca_id", marca.id);
  if (existentesErr) {
    return { ok: false, message: `Não foi possível ler os modelos da marca: ${existentesErr.message}.` };
  }

  const existentes = (existentesRaw ?? []) as ModeloRow[];
  const byNome = new Map<string, ModeloRow>();
  const usedSlugs = new Set<string>();
  for (const m of existentes) {
    byNome.set(normalizeNomeKey(m.nome), m);
    usedSlugs.add(m.slug);
  }

  const toInsert: { marca_id: string; nome: string; slug: string; tipo_veiculo: string }[] = [];
  const idByNome = new Map<string, string>();
  let modelosExistentes = 0;

  for (const item of modelosPayload) {
    const key = normalizeNomeKey(item.nome);
    const already = byNome.get(key);
    if (already) {
      modelosExistentes += 1;
      idByNome.set(key, already.id);
      continue;
    }
    const slug = allocateSlug(slugifyModelo(item.nome), usedSlugs);
    toInsert.push({
      marca_id: marca.id,
      nome: item.nome,
      slug,
      tipo_veiculo: classifyTipoVeiculoModelo(vehicleType, item.nome),
    });
  }

  let modelosNovos = 0;
  for (const chunk of chunkArray(toInsert, MODELO_CHUNK)) {
    const { data, error } = await supabase
      .from("modelos")
      .insert(chunk)
      .select("id, nome, slug");
    if (error) {
      if (error.code === "23505") {
        const { data: again } = await supabase.from("modelos").select("id, nome, slug").eq("marca_id", marca.id);
        for (const m of (again ?? []) as ModeloRow[]) {
          byNome.set(normalizeNomeKey(m.nome), m);
        }
        for (const row of chunk) {
          const found = byNome.get(normalizeNomeKey(row.nome));
          if (found) {
            idByNome.set(normalizeNomeKey(row.nome), found.id);
            modelosExistentes += 1;
          }
        }
        continue;
      }
      return { ok: false, message: `Não foi possível salvar modelos: ${error.message}.` };
    }
    for (const m of (data ?? []) as ModeloRow[]) {
      idByNome.set(normalizeNomeKey(m.nome), m.id);
      byNome.set(normalizeNomeKey(m.nome), m);
      modelosNovos += 1;
    }
  }

  const modeloIds = [...new Set(idByNome.values())];
  const existingAnoKeys = new Set<string>();
  for (const ids of chunkArray(modeloIds, 80)) {
    const { data: anosRows, error: anosErr } = await supabase
      .from("modelo_anos")
      .select("modelo_id, ano")
      .in("modelo_id", ids);
    if (anosErr) {
      return { ok: false, message: `Não foi possível ler os anos cadastrados: ${anosErr.message}.` };
    }
    for (const row of anosRows ?? []) {
      existingAnoKeys.add(`${row.modelo_id}:${row.ano}`);
    }
  }

  const anosNovos: { modelo_id: string; ano: number }[] = [];
  for (const item of modelosPayload) {
    const modeloId = idByNome.get(normalizeNomeKey(item.nome));
    if (!modeloId) continue;
    for (const ano of item.anos) {
      const key = `${modeloId}:${ano}`;
      if (existingAnoKeys.has(key)) continue;
      existingAnoKeys.add(key);
      anosNovos.push({ modelo_id: modeloId, ano });
    }
  }

  let anosInseridos = 0;
  for (const chunk of chunkArray(anosNovos, ANO_CHUNK)) {
    const { error } = await supabase.from("modelo_anos").upsert(chunk, {
      onConflict: "modelo_id,ano",
      ignoreDuplicates: true,
    });
    if (error) {
      return { ok: false, message: `Não foi possível salvar os anos: ${error.message}.` };
    }
    anosInseridos += chunk.length;
  }

  revalidatePath("/admin/marcas-e-modelos");
  revalidatePath("/admin/marcas");
  revalidatePath("/admin/modelos");
  revalidatePath("/admin/produtos/novo");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/produtos");

  return {
    ok: true,
    marca: { nome: marca.nome, slug: marca.slug, status: marcaStatus },
    modelosNovos,
    modelosExistentes,
    anosInseridos,
    tipoFonte: vehicleType,
  };
}
