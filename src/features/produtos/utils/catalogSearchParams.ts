/** Filtros do catálogo vindos da URL (`/produtos?…`). */
export type CatalogFilters = {
  /** Texto livre (título, código, marca/modelo na compatibilidade). */
  q: string | null;
  categoriaIds: string[];
  marcaIds: string[];
  precoMin: number | null;
  precoMax: number | null;
};

function parseCommaList(raw: string | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNumberParam(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Para `useSearchParams().toString()` ou `URLSearchParams`. */
export function parseCatalogSearchParamsFromUrlSearchParams(sp: URLSearchParams): CatalogFilters {
  const o: Record<string, string | undefined> = {};
  sp.forEach((value, key) => {
    o[key] = value;
  });
  return parseCatalogSearchParams(o);
}

/** Parâmetro `q` em `/`, `/produtos` ou outras rotas. */
export function parseProductSearchQ(sp: Record<string, string | string[] | undefined>): string | null {
  const raw = sp.q;
  const s = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const t = (s ?? "").trim();
  return t ? t : null;
}

export function parseCatalogSearchParams(
  sp: Record<string, string | string[] | undefined>
): CatalogFilters {
  const categoriasRaw = typeof sp.categorias === "string" ? sp.categorias : undefined;
  const marcasRaw = typeof sp.marcas === "string" ? sp.marcas : undefined;
  const precoMinRaw = typeof sp.preco_min === "string" ? sp.preco_min : undefined;
  const precoMaxRaw = typeof sp.preco_max === "string" ? sp.preco_max : undefined;

  return {
    q: parseProductSearchQ(sp),
    categoriaIds: parseCommaList(categoriasRaw),
    marcaIds: parseCommaList(marcasRaw),
    precoMin: parseNumberParam(precoMinRaw),
    precoMax: parseNumberParam(precoMaxRaw),
  };
}

export function buildCatalogQueryString(filters: CatalogFilters, sliderMax: number): string {
  const p = new URLSearchParams();
  if (filters.q?.trim()) p.set("q", filters.q.trim());
  if (filters.categoriaIds.length) p.set("categorias", filters.categoriaIds.join(","));
  if (filters.marcaIds.length) p.set("marcas", filters.marcaIds.join(","));
  const min = filters.precoMin;
  const max = filters.precoMax;
  const priceActive = (min != null && min > 0) || (max != null && max < sliderMax);
  if (priceActive) {
    if (min != null && min > 0) p.set("preco_min", String(Math.round(min)));
    if (max != null && max < sliderMax) p.set("preco_max", String(Math.round(max)));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function catalogFiltersActive(filters: CatalogFilters, sliderMax: number): boolean {
  return (
    Boolean(filters.q?.trim()) ||
    filters.categoriaIds.length > 0 ||
    filters.marcaIds.length > 0 ||
    (filters.precoMin != null && filters.precoMin > 0) ||
    (filters.precoMax != null && filters.precoMax < sliderMax)
  );
}

/** Zera faixas equivalentes a “sem filtro de preço” após ler a URL. */
export function normalizeCatalogFilters(filters: CatalogFilters, sliderMax: number): CatalogFilters {
  const q = filters.q?.trim() || null;
  let precoMin = filters.precoMin;
  let precoMax = filters.precoMax;
  if (precoMin === 0) precoMin = null;
  if (precoMax != null && precoMax >= sliderMax) precoMax = null;
  return { ...filters, q, precoMin, precoMax };
}

export function catalogFilterSummary(
  filters: CatalogFilters,
  categorias: { id: string; nome: string }[],
  marcas: { id: string; nome: string }[],
  sliderMax: number
): string {
  if (!catalogFiltersActive(filters, sliderMax)) return "Sem filtro aplicado";

  const parts: string[] = [];
  if (filters.q?.trim()) parts.push(`Busca: “${filters.q.trim()}”`);
  if (filters.categoriaIds.length) {
    const names = filters.categoriaIds
      .map((id) => categorias.find((c) => c.id === id)?.nome)
      .filter(Boolean) as string[];
    if (names.length) parts.push(`Categorias: ${names.join(", ")}`);
  }
  if (filters.marcaIds.length) {
    const names = filters.marcaIds
      .map((id) => marcas.find((m) => m.id === id)?.nome)
      .filter(Boolean) as string[];
    if (names.length) parts.push(`Marcas: ${names.join(", ")}`);
  }
  const pMin = filters.precoMin;
  const pMax = filters.precoMax;
  if ((pMin != null && pMin > 0) || (pMax != null && pMax < sliderMax)) {
    const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
    const a = pMin != null && pMin > 0 ? fmt.format(pMin) : fmt.format(0);
    const b = pMax != null && pMax < sliderMax ? fmt.format(pMax) : fmt.format(sliderMax);
    parts.push(`Preço: ${a} — ${b}`);
  }

  return parts.length ? parts.join(" · ") : "Sem filtro aplicado";
}
