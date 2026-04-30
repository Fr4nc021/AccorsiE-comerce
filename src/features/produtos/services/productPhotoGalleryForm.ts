type ProductPhotoInput = {
  foto: string;
  is_principal?: boolean;
  ordem?: number;
};

export type NormalizedProductPhoto = {
  foto: string;
  is_principal: boolean;
  ordem: number;
};

type ParseGalleryResult =
  | {
      ok: true;
      photos: NormalizedProductPhoto[];
      principalFoto: string | null;
    }
  | {
      ok: false;
      message: string;
    };

function normalizeInputList(list: ProductPhotoInput[]): ProductPhotoInput[] {
  const unique = new Set<string>();
  const normalized: ProductPhotoInput[] = [];
  for (const item of list) {
    const foto = String(item.foto ?? "").trim();
    if (!foto || unique.has(foto)) continue;
    unique.add(foto);
    normalized.push({
      foto,
      is_principal: item.is_principal === true,
      ordem: Number.isFinite(item.ordem) ? Number(item.ordem) : undefined,
    });
  }
  return normalized;
}

function parseGalleryJson(raw: string): ProductPhotoInput[] | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Formato de galeria inválido.");
  }
  return parsed.map((item) => {
    if (typeof item === "string") {
      return { foto: item };
    }
    if (item && typeof item === "object") {
      return {
        foto: String((item as { foto?: unknown }).foto ?? ""),
        is_principal: (item as { is_principal?: unknown }).is_principal === true,
        ordem: Number((item as { ordem?: unknown }).ordem),
      };
    }
    return { foto: "" };
  });
}

export function parseProductPhotoGalleryFromForm(formData: FormData): ParseGalleryResult {
  const legacyFoto = String(formData.get("foto") ?? "").trim();
  const rawGallery = String(formData.get("fotos_json") ?? formData.get("fotos") ?? "").trim();

  let input: ProductPhotoInput[] = [];
  if (rawGallery) {
    try {
      input = parseGalleryJson(rawGallery) ?? [];
    } catch {
      return { ok: false, message: "A galeria de fotos enviada está inválida." };
    }
  } else if (legacyFoto) {
    input = [{ foto: legacyFoto, is_principal: true, ordem: 0 }];
  }

  const normalizedInput = normalizeInputList(input);
  if (normalizedInput.length === 0) {
    return { ok: true, photos: [], principalFoto: null };
  }

  const explicitPrincipal = normalizedInput.find((item) => item.is_principal);
  const principalFoto = explicitPrincipal?.foto ?? normalizedInput[0]?.foto ?? null;

  const ordered = [...normalizedInput].sort((a, b) => {
    const ao = Number.isFinite(a.ordem) ? Number(a.ordem) : Number.MAX_SAFE_INTEGER;
    const bo = Number.isFinite(b.ordem) ? Number(b.ordem) : Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });

  const photos = ordered.map((item, idx) => ({
    foto: item.foto,
    is_principal: item.foto === principalFoto,
    ordem: idx,
  }));

  return { ok: true, photos, principalFoto };
}
