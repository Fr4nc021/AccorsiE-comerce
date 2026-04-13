/** Caminho do objeto dentro do bucket a partir da URL pública ou caminho salvo no banco. */
export function parseProductImageStoragePath(fotoRef: string, bucket: string): string | null {
  const t = fotoRef.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const p = u.pathname;
      const markers = [`/storage/v1/object/public/${bucket}/`, `/object/public/${bucket}/`];
      for (const m of markers) {
        const i = p.indexOf(m);
        if (i !== -1) {
          const raw = p.slice(i + m.length);
          try {
            return decodeURIComponent(raw);
          } catch {
            return raw;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  const path = t.replace(/^\/+/, "");
  return path || null;
}
