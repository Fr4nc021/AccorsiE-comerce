"use client";

import { useCallback, useMemo, useState } from "react";

type Item = { code: string; name: string };

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

export function ConsultaFipeClient() {
  const [brands, setBrands] = useState<Item[]>([]);
  const [models, setModels] = useState<Item[]>([]);
  const [brandCode, setBrandCode] = useState("");
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandsLoadedAt, setBrandsLoadedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportHint, setExportHint] = useState<string | null>(null);
  const [anosMode, setAnosMode] = useState<"fipe" | "fipe_or_range" | "range" | "none">("fipe_or_range");
  const [anoDesde, setAnoDesde] = useState(1990);
  const [anoAte, setAnoAte] = useState(() => new Date().getFullYear());
  const [onlyModeloAnos, setOnlyModeloAnos] = useState(false);
  const [marcaSlugSql, setMarcaSlugSql] = useState("");

  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [brands],
  );

  const loadBrands = useCallback(async () => {
    setError(null);
    setLoadingBrands(true);
    setBrands([]);
    setModels([]);
    setBrandCode("");
    try {
      const result = await readApiJson("/api/fipe/cars/brands");
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
  }, []);

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

  const loadModels = useCallback(async (code: string) => {
    setBrandCode(code);
    setModels([]);
    if (!code) return;
    setError(null);
    setLoadingModels(true);
    try {
      const enc = encodeURIComponent(code);
      const result = await readApiJson(`/api/fipe/cars/brands/${enc}/models`);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const list = normalizeList(result.data);
      setModels(list);
      if (list.length === 0) {
        setError("Nenhum modelo retornado para esta marca (lista vazia ou formato inesperado).");
      }
    } finally {
      setLoadingModels(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-store-line bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-store-navy-muted">Ferramenta</p>
        <h1 className="mt-2 text-2xl font-black text-store-navy sm:text-3xl">Consulta FIPE (marcas e modelos)</h1>
        <p className="mt-3 text-sm leading-relaxed text-store-navy-muted">
          Carrega dados da API Parallelum via <code className="rounded bg-store-subtle px-1.5 py-0.5 text-xs">/api/fipe</code>{" "}
          no servidor. Use para validar token e listagem de modelos cadastrados na tabela FIPE.
        </p>

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
              disabled={loadingModels}
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
          <h2 className="text-lg font-bold text-store-navy">Modelos</h2>
          <div className="mt-4 rounded-xl border border-dashed border-store-line bg-store-subtle/40 p-4">
            <p className="text-sm font-semibold text-store-navy">Exportar para o Supabase (admin)</p>
            <p className="mt-1 text-xs leading-relaxed text-store-navy-muted">
              Gera um <strong>JSON</strong> (marca, modelos, anos) e um <strong>SQL</strong> idempotente igual ao seed FIPE do projeto —
              para colar no SQL Editor ou salvar em <code className="text-xs">supabase/migrations/</code>. É necessário estar logado como{" "}
              <strong>administrador</strong>.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="fipe-anos-mode" className="block text-xs font-semibold text-store-navy">
                  Anos no Supabase
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
                  (marca e modelos já existem no Supabase). Os slugs dos modelos no SQL seguem a mesma regra deste export.
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
          {loadingModels ? (
            <p className="mt-4 text-sm text-store-navy-muted">Carregando modelos…</p>
          ) : models.length > 0 ? (
            <>
              <p className="mt-1 text-sm text-store-navy-muted">
                {models.length} modelo(s) para a marca selecionada.
              </p>
              <ul className="mt-4 max-h-[420px] divide-y divide-store-line overflow-y-auto rounded-xl border border-store-line">
                {[...models]
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((m) => (
                    <li key={`${m.code}-${m.name}`} className="px-4 py-2.5 text-sm text-store-navy">
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-2 text-store-navy-muted">código {m.code}</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : !error ? (
            <p className="mt-4 text-sm text-store-navy-muted">Selecione uma marca para ver os modelos.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
