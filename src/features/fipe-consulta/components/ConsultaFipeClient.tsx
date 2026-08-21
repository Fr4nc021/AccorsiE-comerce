"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TIPO_VEICULO_MODELO_LABELS } from "@/features/compatibilidade/constants/tipoVeiculoModelo";
import {
  importFipeBrand,
  type ImportFipeBrandResult,
} from "@/features/fipe-consulta/services/importFipeBrand";
import { classifyTipoVeiculoModelo } from "@/services/fipe/classifyTipoVeiculoModelo";
import { extractYearsFromFipePayload } from "@/services/fipe/fipeSlugs";
import type { FipeVehicleType } from "@/services/fipe/parallelumClient";

type Item = { code: string; name: string };

type ModelRow = Item & {
  anos: number[];
  anosStatus: "pending" | "ready" | "error";
};

const YEARS_CONCURRENCY = 3;

function normalizeItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = o.code ?? o.codigo;
  const name = o.name ?? o.nome;
  if (code == null) return null;
  const nameStr = String(name ?? "").trim();
  if (!nameStr) return null;
  return { code: String(code), name: nameStr };
}

function normalizeList(data: unknown): Item[] {
  if (!Array.isArray(data)) {
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      const inner = o.models ?? o.modelos;
      if (Array.isArray(inner)) return normalizeList(inner);
    }
    return [];
  }
  const out: Item[] = [];
  for (const row of data) {
    const item = normalizeItem(row);
    if (item) out.push(item);
  }
  return out;
}

async function readApiJson(path: string): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const res = await fetch(path, { cache: "no-store" });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg =
      body &&
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : body &&
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : `Erro HTTP ${res.status}`;
    return { ok: false, message: msg };
  }
  return { ok: true, data: body };
}

function formatYearRanges(anos: number[]): string {
  if (anos.length === 0) return "sem anos na FIPE";
  const sorted = [...anos].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const y = sorted[i];
    if (y === prev + 1) {
      prev = y;
      continue;
    }
    ranges.push(start === prev ? String(start) : `${start}–${prev}`);
    start = prev = y;
  }
  ranges.push(start === prev ? String(start) : `${start}–${prev}`);
  return ranges.join(", ");
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  shouldAbort: () => boolean,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      if (shouldAbort()) return;
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      await fn(items[idx]);
    }
  }
  const n = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

export function ConsultaFipeClient() {
  const [vehicleType, setVehicleType] = useState<FipeVehicleType>("cars");
  const [brands, setBrands] = useState<Item[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [brandCode, setBrandCode] = useState("");
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [yearsProgress, setYearsProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [brandsLoadedAt, setBrandsLoadedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportHint, setExportHint] = useState<string | null>(null);
  const [anosMode, setAnosMode] = useState<"fipe" | "fipe_or_range" | "range" | "none">("fipe_or_range");
  const [anoDesde, setAnoDesde] = useState(1990);
  const [anoAte, setAnoAte] = useState(() => new Date().getFullYear());
  const [onlyModeloAnos, setOnlyModeloAnos] = useState(false);
  const [marcaSlugSql, setMarcaSlugSql] = useState("");
  const [confirmImport, setConfirmImport] = useState(false);
  const [importResult, setImportResult] = useState<ImportFipeBrandResult | null>(null);
  const [importing, startImport] = useTransition();
  const loadGen = useRef(0);

  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [brands],
  );

  const selectedBrand = useMemo(
    () => sortedBrands.find((b) => b.code === brandCode) ?? null,
    [sortedBrands, brandCode],
  );

  const sortedModels = useMemo(
    () => [...models].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [models],
  );

  const yearsReady = models.length > 0 && models.every((m) => m.anosStatus !== "pending");
  const canImport = Boolean(selectedBrand) && yearsReady && !loadingModels && !loadingYears && !importing;

  const resetCatalog = useCallback(() => {
    loadGen.current += 1;
    setBrands([]);
    setModels([]);
    setBrandCode("");
    setBrandsLoadedAt(null);
    setError(null);
    setExportHint(null);
    setImportResult(null);
    setLoadingYears(false);
    setYearsProgress({ done: 0, total: 0 });
  }, []);

  const loadBrands = useCallback(async () => {
    loadGen.current += 1;
    setError(null);
    setImportResult(null);
    setLoadingBrands(true);
    setBrands([]);
    setModels([]);
    setBrandCode("");
    setLoadingYears(false);
    setYearsProgress({ done: 0, total: 0 });
    try {
      const result = await readApiJson(`/api/fipe/${vehicleType}/brands`);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const list = normalizeList(result.data);
      if (list.length === 0) {
        setError("A API respondeu, mas não veio nenhuma marca no formato esperado.");
        return;
      }
      setBrands(list);
      setBrandsLoadedAt(new Date().toLocaleString("pt-BR"));
    } finally {
      setLoadingBrands(false);
    }
  }, [vehicleType]);

  const downloadMigrationBundle = useCallback(async () => {
    if (!brandCode) return;
    setExportHint(null);
    setExporting(true);
    try {
      const params = new URLSearchParams({
        brandCode,
        format: "both",
        delayMs: "400",
        anosMode,
        anoDesde: String(anoDesde),
        anoAte: String(anoAte),
      });
      if (onlyModeloAnos) params.set("onlyModeloAnos", "true");
      if (marcaSlugSql.trim()) params.set("marcaSlug", marcaSlugSql.trim());
      const res = await fetch(`/api/admin/fipe-catalog-export?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as
        | { catalog?: unknown; sql?: string; message?: string; error?: string }
        | null;
      if (!res.ok) {
        const msg = body?.message ?? body?.error ?? `Erro HTTP ${res.status}`;
        setExportHint(msg);
        return;
      }
      if (!body?.catalog || typeof body.sql !== "string") {
        setExportHint("Resposta inesperada do servidor.");
        return;
      }
      const safeName = brandCode.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const stamp = new Date().toISOString().slice(0, 10);
      const jsonBlob = new Blob([JSON.stringify(body.catalog, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const aJson = document.createElement("a");
      aJson.href = jsonUrl;
      aJson.download = `fipe-catalog-marca-${safeName}-${stamp}.json`;
      aJson.click();
      URL.revokeObjectURL(jsonUrl);

      const sqlBlob = new Blob([body.sql], { type: "text/plain;charset=utf-8" });
      const sqlUrl = URL.createObjectURL(sqlBlob);
      const aSql = document.createElement("a");
      aSql.href = sqlUrl;
      aSql.download = `fipe-marca-${safeName}-${onlyModeloAnos ? "solo-modelo-anos" : "seed"}-${stamp}.sql`;
      aSql.click();
      URL.revokeObjectURL(sqlUrl);

      setExportHint(
        onlyModeloAnos
          ? "SQL cirúrgico baixado: só INSERT em modelo_anos. Confira no JSON o slug de cada modelo; se a marca no Supabase tiver slug diferente, use o campo «Slug da marca no Supabase» e gere de novo."
          : anosMode === "range"
            ? "Arquivos baixados. Modo «intervalo»: o SQL inclui todos os anos entre os limites para cada modelo (rápido; sem uma requisição por modelo na FIPE)."
            : anosMode === "none"
              ? "Arquivos baixados. Sem linhas em modelo_anos — cadastre anos depois em «Marcas e modelos» se for vincular compatibilidade."
              : "Arquivos baixados. Com modo FIPE há uma chamada por modelo para buscar anos; use «intervalo» ou «FIPE + intervalo» se a API vier vazia.",
      );
    } catch {
      setExportHint("Falha ao exportar. Verifique se está logado como administrador.");
    } finally {
      setExporting(false);
    }
  }, [brandCode, anosMode, anoDesde, anoAte, onlyModeloAnos, marcaSlugSql]);

  const loadModels = useCallback(
    async (code: string) => {
      const gen = ++loadGen.current;
      setBrandCode(code);
      setModels([]);
      setImportResult(null);
      setExportHint(null);
      setYearsProgress({ done: 0, total: 0 });
      if (!code) {
        setLoadingYears(false);
        return;
      }
      setError(null);
      setLoadingModels(true);
      setLoadingYears(false);
      try {
        const enc = encodeURIComponent(code);
        const result = await readApiJson(`/api/fipe/${vehicleType}/brands/${enc}/models`);
        if (loadGen.current !== gen) return;
        if (!result.ok) {
          setError(result.message);
          return;
        }
        const list = normalizeList(result.data);
        if (list.length === 0) {
          setError("Nenhum modelo retornado para esta marca (lista vazia ou formato inesperado).");
          setModels([]);
          return;
        }
        const rows: ModelRow[] = list.map((m) => ({
          ...m,
          anos: [],
          anosStatus: "pending",
        }));
        setModels(rows);
        setLoadingModels(false);
        setLoadingYears(true);
        setYearsProgress({ done: 0, total: rows.length });

        await mapPool(
          rows,
          YEARS_CONCURRENCY,
          async (model) => {
            if (loadGen.current !== gen) return;
            const yearsPath = `/api/fipe/${vehicleType}/brands/${enc}/models/${encodeURIComponent(model.code)}/years`;
            const yearsRes = await readApiJson(yearsPath);
            if (loadGen.current !== gen) return;
            const anos = yearsRes.ok ? extractYearsFromFipePayload(yearsRes.data) : [];
            const anosStatus: ModelRow["anosStatus"] = yearsRes.ok ? "ready" : "error";
            setModels((prev) =>
              prev.map((m) => (m.code === model.code && m.name === model.name ? { ...m, anos, anosStatus } : m)),
            );
            setYearsProgress((p) => ({ ...p, done: Math.min(p.total, p.done + 1) }));
          },
          () => loadGen.current !== gen,
        );
      } finally {
        if (loadGen.current === gen) {
          setLoadingModels(false);
          setLoadingYears(false);
        }
      }
    },
    [vehicleType],
  );

  function runImport() {
    if (!selectedBrand || !canImport) return;
    setConfirmImport(false);
    setImportResult(null);
    startImport(async () => {
      const result = await importFipeBrand({
        marcaNome: selectedBrand.name,
        vehicleType,
        modelos: models.map((m) => ({ nome: m.name, anos: m.anos })),
      });
      setImportResult(result);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ConfirmDialog
        open={confirmImport}
        onOpenChange={setConfirmImport}
        title="Importar para o catálogo?"
        variant="neutral"
        pending={importing}
        confirmLabel="Sim, gravar no banco"
        description={
          selectedBrand ? (
            <>
              Vai cadastrar a marca <strong className="text-gray-800">“{selectedBrand.name}”</strong> com{" "}
              <strong className="text-gray-800">{models.length}</strong> modelo(s) e os anos listados na FIPE.
              Itens que já existem não são duplicados.
            </>
          ) : (
            "Selecione uma marca primeiro."
          )
        }
        onConfirm={runImport}
      />

      <div className="rounded-2xl border border-store-line bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-store-navy-muted">Ferramenta</p>
        <h1 className="mt-2 text-2xl font-black text-store-navy sm:text-3xl">Consulta FIPE (marcas e modelos)</h1>
        <p className="mt-3 text-sm leading-relaxed text-store-navy-muted">
          Liste marcas, modelos e anos da tabela FIPE. Depois grave direto no catálogo (Supabase). Caminhão vem da
          FIPE de caminhões; camionete é sugerida pelo nome (a FIPE não separa picape).
        </p>

        <div className="mt-6">
          <p className="text-sm font-semibold text-store-navy">Tipo na FIPE</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (vehicleType === "cars") return;
                setVehicleType("cars");
                resetCatalog();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                vehicleType === "cars"
                  ? "bg-store-navy text-white"
                  : "border border-store-line bg-white text-store-navy hover:bg-store-subtle"
              }`}
            >
              Carros
            </button>
            <button
              type="button"
              onClick={() => {
                if (vehicleType === "trucks") return;
                setVehicleType("trucks");
                resetCatalog();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                vehicleType === "trucks"
                  ? "bg-store-navy text-white"
                  : "border border-store-line bg-white text-store-navy hover:bg-store-subtle"
              }`}
            >
              Caminhões
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadBrands()}
            disabled={loadingBrands}
            className="inline-flex rounded-lg bg-store-navy px-4 py-2.5 text-sm font-bold text-white transition hover:bg-store-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingBrands ? "Carregando marcas…" : "Carregar marcas"}
          </button>
          {brandsLoadedAt ? (
            <span className="self-center text-xs text-store-navy-muted">Última carga: {brandsLoadedAt}</span>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          >
            {error}
          </div>
        ) : null}

        {importResult?.ok === false ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          >
            {importResult.message}
          </div>
        ) : null}

        {importResult?.ok === true ? (
          <div
            role="status"
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          >
            <p className="font-semibold text-emerald-900">
              {importResult.marca.status === "created" ? "Marca cadastrada" : "Marca já existia"}:{" "}
              {importResult.marca.nome}
            </p>
            <p className="mt-1">
              {importResult.modelosNovos} modelo(s) novo(s), {importResult.modelosExistentes} já existiam,{" "}
              {importResult.anosInseridos} ano(s) inserido(s).
            </p>
            <p className="mt-2">
              <Link href="/admin/marcas-e-modelos" className="font-semibold text-admin-accent hover:underline">
                Ver em Marcas e modelos
              </Link>
            </p>
          </div>
        ) : null}

        {sortedBrands.length > 0 ? (
          <div className="mt-6 space-y-2">
            <label htmlFor="fipe-marca" className="block text-sm font-semibold text-store-navy">
              Marca
            </label>
            <select
              id="fipe-marca"
              className="w-full rounded-lg border border-store-line bg-white px-3 py-2.5 text-sm text-store-navy shadow-sm focus:border-store-navy focus:outline-none focus:ring-1 focus:ring-store-navy"
              value={brandCode}
              onChange={(e) => void loadModels(e.target.value)}
              disabled={loadingModels || loadingYears}
            >
              <option value="">Selecione uma marca…</option>
              {sortedBrands.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-store-navy-muted">{sortedBrands.length} marcas disponíveis.</p>
          </div>
        ) : null}
      </div>

      {brandCode ? (
        <div className="rounded-2xl border border-store-line bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-store-navy">Modelos e anos</h2>
          <p className="mt-1 text-sm text-store-navy-muted">
            Os anos vêm da FIPE para cada modelo. O import grava exatamente o que está listado abaixo.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canImport}
              onClick={() => setConfirmImport(true)}
              className="inline-flex rounded-lg bg-store-navy px-4 py-2.5 text-sm font-bold text-white transition hover:bg-store-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? "Gravando no catálogo…" : "Importar para o catálogo"}
            </button>
            {loadingYears ? (
              <span className="text-xs text-store-navy-muted">
                Carregando anos… {yearsProgress.done}/{yearsProgress.total}
              </span>
            ) : null}
          </div>

          {loadingModels ? (
            <p className="mt-4 text-sm text-store-navy-muted">Carregando modelos…</p>
          ) : sortedModels.length > 0 ? (
            <>
              <p className="mt-4 text-sm text-store-navy-muted">
                {sortedModels.length} modelo(s) para {selectedBrand?.name ?? "a marca selecionada"}.
              </p>
              <ul className="mt-4 max-h-[520px] divide-y divide-store-line overflow-y-auto rounded-xl border border-store-line">
                {sortedModels.map((m) => {
                  const tipo = classifyTipoVeiculoModelo(vehicleType, m.name);
                  return (
                    <li key={`${m.code}-${m.name}`} className="px-4 py-2.5 text-sm text-store-navy">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-store-navy-muted">
                          {TIPO_VEICULO_MODELO_LABELS[tipo]} · código {m.code}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-store-navy-muted">
                        {m.anosStatus === "pending"
                          ? "Carregando anos…"
                          : m.anosStatus === "error"
                            ? "Não foi possível obter os anos (o modelo pode ser importado sem anos)."
                            : formatYearRanges(m.anos)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : !error ? (
            <p className="mt-4 text-sm text-store-navy-muted">Selecione uma marca para ver os modelos.</p>
          ) : null}

          {vehicleType === "cars" ? (
            <div className="mt-6 rounded-xl border border-dashed border-store-line bg-store-subtle/40 p-4">
              <p className="text-sm font-semibold text-store-navy">Backup SQL (opcional)</p>
              <p className="mt-1 text-xs leading-relaxed text-store-navy-muted">
                Gera JSON e SQL para colar no SQL Editor. O fluxo principal é o botão de importar acima.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="fipe-anos-mode" className="block text-xs font-semibold text-store-navy">
                    Anos no SQL
                  </label>
                  <select
                    id="fipe-anos-mode"
                    value={anosMode}
                    onChange={(e) =>
                      setAnosMode(e.target.value as "fipe" | "fipe_or_range" | "range" | "none")
                    }
                    className="mt-1 w-full rounded-lg border border-store-line bg-white px-2 py-2 text-xs text-store-navy"
                  >
                    <option value="fipe">Só FIPE (uma requisição por modelo)</option>
                    <option value="fipe_or_range">
                      FIPE e, se vazio, preencher com intervalo (recomendado se a FIPE não trouxe anos)
                    </option>
                    <option value="range">Só intervalo em massa (rápido; mesmo intervalo para todos)</option>
                    <option value="none">Sem anos (só marcas/modelos)</option>
                  </select>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <div className="flex-1">
                    <label htmlFor="fipe-ano-desde" className="block text-xs font-semibold text-store-navy">
                      Ano desde
                    </label>
                    <input
                      id="fipe-ano-desde"
                      type="number"
                      min={1900}
                      max={2100}
                      value={anoDesde}
                      onChange={(e) => setAnoDesde(Number(e.target.value) || 1990)}
                      className="mt-1 w-full rounded-lg border border-store-line px-2 py-2 text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="fipe-ano-ate" className="block text-xs font-semibold text-store-navy">
                      Ano até
                    </label>
                    <input
                      id="fipe-ano-ate"
                      type="number"
                      min={1900}
                      max={2100}
                      value={anoAte}
                      onChange={(e) => setAnoAte(Number(e.target.value) || new Date().getFullYear())}
                      className="mt-1 w-full rounded-lg border border-store-line px-2 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2 rounded-lg border border-store-line/80 bg-white/60 p-3">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-store-navy">
                  <input
                    type="checkbox"
                    checked={onlyModeloAnos}
                    onChange={(e) => setOnlyModeloAnos(e.target.checked)}
                    className="mt-0.5 rounded border-store-line"
                  />
                  <span>
                    <strong>Só completar anos</strong> — gera SQL apenas com <code className="text-[10px]">modelo_anos</code>{" "}
                    (marca e modelos já existem no Supabase).
                  </span>
                </label>
                {onlyModeloAnos ? (
                  <div>
                    <label htmlFor="fipe-marca-slug-sql" className="block text-xs font-semibold text-store-navy">
                      Slug da marca no Supabase (opcional)
                    </label>
                    <input
                      id="fipe-marca-slug-sql"
                      type="text"
                      placeholder="ex.: volkswagen — só se for diferente do slug calculado pela FIPE"
                      value={marcaSlugSql}
                      onChange={(e) => setMarcaSlugSql(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-store-line px-2 py-2 text-xs"
                    />
                  </div>
                ) : null}
                {onlyModeloAnos && anosMode === "none" ? (
                  <p className="text-xs text-amber-800">Escolha um modo de anos diferente de «sem anos».</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={exporting || !brandCode || (onlyModeloAnos && anosMode === "none")}
                onClick={() => void downloadMigrationBundle()}
                className="mt-3 inline-flex rounded-lg border border-store-line bg-white px-4 py-2 text-sm font-bold text-store-navy transition hover:bg-store-subtle disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? "Gerando JSON e SQL… (pode levar vários minutos)" : "Baixar JSON + SQL desta marca"}
              </button>
              {exportHint ? (
                <p className="mt-2 text-xs text-store-navy-muted" role="status">
                  {exportHint}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
