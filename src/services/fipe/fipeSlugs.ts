/** Slugs alinhados ao script `scripts/generate-fipe-carros-seed.mjs`. */

export function slugifyMarca(input: string): string {
  const s = String(input)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "marca";
}

export function slugifyModelo(input: string): string {
  const s = String(input)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "modelo";
}

export function allocateSlug(base: string, usedSet: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (usedSet.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 500) candidate = `${base}-x-${Date.now()}`;
  }
  usedSet.add(candidate);
  return candidate;
}

export function escapeSqlString(s: string): string {
  return String(s).replace(/'/g, "''");
}

export function parseAnoFromFipeCode(codigo: unknown): number | null {
  const m = String(codigo ?? "").match(/^(\d{4})/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  return y;
}

/** Entrada típica do endpoint de anos FIPE (`code`/`name` ou string solta). */
export function extractYearFromFipeYearEntry(entry: unknown): number | null {
  if (entry == null) return null;
  if (typeof entry === "string" || typeof entry === "number") {
    return parseAnoFromFipeCode(entry);
  }
  if (typeof entry === "object") {
    const o = entry as Record<string, unknown>;
    const fromCode = parseAnoFromFipeCode(o.code ?? o.codigo);
    if (fromCode != null) return fromCode;
    return parseAnoFromFipeCode(o.name ?? o.nome);
  }
  return null;
}
