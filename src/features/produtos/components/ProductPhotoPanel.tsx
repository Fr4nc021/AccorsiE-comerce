"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { parseProductImageStoragePath } from "@/services/storage/productImagePath";

const ACCENT = "#1d63ed";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const REQUIRED_IMAGE_WIDTH = 1200;
const REQUIRED_IMAGE_HEIGHT = 1200;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT_FROM_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

function productImagesBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET ?? "product-images";
}

function resolvePublicImageUrl(fotoRef: string): string {
  const t = fotoRef.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return createClient()
    .storage.from(productImagesBucket())
    .getPublicUrl(t.replace(/^\/+/, ""))
    .data.publicUrl;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(previewUrl);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error("Não foi possível ler as dimensões da imagem."));
    };

    img.src = previewUrl;
  });
}

function resizeImageToSquare(
  file: File,
  targetWidth: number,
  targetHeight: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(previewUrl);
          reject(new Error("Não foi possível preparar a conversão da imagem."));
          return;
        }

        const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
        const drawWidth = img.naturalWidth * scale;
        const drawHeight = img.naturalHeight * scale;
        const offsetX = (targetWidth - drawWidth) / 2;
        const offsetY = (targetHeight - drawHeight) / 2;

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(previewUrl);
            if (!blob) {
              reject(new Error("Não foi possível converter a imagem para 1200x1200."));
              return;
            }

            const baseName = file.name.replace(/\.[^.]+$/, "") || "produto";
            const normalized = new File([blob], `${baseName}-1200x1200.webp`, {
              type: "image/webp",
              lastModified: Date.now(),
            });
            resolve(normalized);
          },
          "image/webp",
          0.92
        );
      } catch {
        URL.revokeObjectURL(previewUrl);
        reject(new Error("Falha ao redimensionar a imagem."));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error("Não foi possível carregar a imagem para conversão."));
    };

    img.src = previewUrl;
  });
}

type ProductPhotoItem = {
  foto: string;
  is_principal: boolean;
  ordem: number;
};

type ProductPhotoPanelProps = {
  initialFoto?: string;
  initialFotos?: ProductPhotoItem[];
};

function normalizeInitialPhotos(initialFoto: string, initialFotos: ProductPhotoItem[]): ProductPhotoItem[] {
  const unique = new Set<string>();
  const normalized = initialFotos
    .map((item, idx) => ({
      foto: String(item.foto ?? "").trim(),
      is_principal: item.is_principal === true,
      ordem: Number.isFinite(item.ordem) ? Number(item.ordem) : idx,
    }))
    .filter((item) => {
      if (!item.foto || unique.has(item.foto)) return false;
      unique.add(item.foto);
      return true;
    })
    .sort((a, b) => a.ordem - b.ordem)
    .map((item, idx) => ({ ...item, ordem: idx }));

  if (normalized.length === 0 && initialFoto.trim()) {
    return [{ foto: initialFoto.trim(), is_principal: true, ordem: 0 }];
  }
  if (!normalized.some((item) => item.is_principal) && normalized[0]) {
    normalized[0] = { ...normalized[0], is_principal: true };
  }
  return normalized.map((item, idx) => ({ ...item, ordem: idx }));
}

export function ProductPhotoPanel({ initialFoto = "", initialFotos = [] }: ProductPhotoPanelProps) {
  const [photos, setPhotos] = useState<ProductPhotoItem[]>(() =>
    normalizeInitialPhotos(initialFoto, initialFotos)
  );
  const [uploading, setUploading] = useState(false);
  const [removingFoto, setRemovingFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    setPhotos(normalizeInitialPhotos(initialFoto, initialFotos));
  }, [initialFoto, initialFotos]);

  const handleExcluirImagem = async (ref: string) => {
    if (!ref) return;
    setError(null);
    setRemovingFoto(ref);
    try {
      const bucket = productImagesBucket();
      const path = parseProductImageStoragePath(ref, bucket);
      if (path) {
        const { error } = await createClient().storage.from(bucket).remove([path]);
        if (error) {
          setError(
            `Não foi possível excluir no Storage: ${error.message}. O arquivo continua no Supabase até a exclusão funcionar (ver políticas DELETE para o bucket).`
          );
          return;
        }
      }
      setPhotos((prev) => {
        const next = prev.filter((item) => item.foto !== ref).map((item, idx) => ({ ...item, ordem: idx }));
        if (next.length > 0 && !next.some((item) => item.is_principal)) {
          next[0] = { ...next[0], is_principal: true };
        }
        return next;
      });
    } finally {
      setRemovingFoto(null);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    setError(null);
    if (!ALLOWED_MIME.has(file.type)) {
      setError("Use JPEG, PNG, WEBP ou GIF.");
      return null;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Arquivo muito grande (máximo 5 MB).");
      return null;
    }
    let width = 0;
    let height = 0;
    try {
      const dims = await readImageDimensions(file);
      width = dims.width;
      height = dims.height;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível validar a imagem.");
      return null;
    }

    let fileToUpload = file;
    if (width !== REQUIRED_IMAGE_WIDTH || height !== REQUIRED_IMAGE_HEIGHT) {
      if (file.type === "image/gif") {
        setError(
          `GIF fora do padrão não pode ser convertido automaticamente. Envie GIF em ${REQUIRED_IMAGE_WIDTH}x${REQUIRED_IMAGE_HEIGHT}px ou use PNG/JPEG/WEBP para ajuste automático.`
        );
        return null;
      }
      try {
        fileToUpload = await resizeImageToSquare(file, REQUIRED_IMAGE_WIDTH, REQUIRED_IMAGE_HEIGHT);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível ajustar a imagem para 1200x1200.");
        return null;
      }
    }

    if (fileToUpload.size > MAX_FILE_BYTES) {
      setError("Imagem ajustada ficou maior que 5 MB. Tente uma imagem menor.");
      return null;
    }

    try {
      const supabase = createClient();
      const bucket = productImagesBucket();
      const ext = EXT_FROM_MIME[fileToUpload.type] ?? "jpg";
      const path = `produtos/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, fileToUpload, {
        contentType: fileToUpload.type,
        upsert: false,
      });

      if (upErr) {
        const msg =
          upErr.message.includes("JWT") ||
          upErr.message.includes("policy") ||
          upErr.message.includes("row-level security") ||
          upErr.message.includes("RLS")
            ? "Sem permissão no Storage: o bucket só permitia upload logado (authenticated). Sem Auth no admin, inclua uma política de INSERT para o role anon neste bucket (migração 20260410200000 no projeto) ou implemente login Supabase."
            : upErr.message;
        throw new Error(msg);
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio da imagem.");
      return null;
    }
  };

  const addUrlsToGallery = useCallback((urls: string[]) => {
    if (urls.length === 0) return;
    setPhotos((prev) => {
      const existing = new Set(prev.map((item) => item.foto));
      const incoming = urls.filter((url) => url.trim() && !existing.has(url.trim())).map((url) => url.trim());
      if (incoming.length === 0) return prev;
      const base = prev.map((item, idx) => ({ ...item, ordem: idx }));
      const appended = incoming.map((foto, idx) => ({
        foto,
        is_principal: false,
        ordem: base.length + idx,
      }));
      const merged = [...base, ...appended];
      if (!merged.some((item) => item.is_principal) && merged[0]) {
        merged[0] = { ...merged[0], is_principal: true };
      }
      return merged;
    });
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      try {
        const uploaded: string[] = [];
        for (const file of list) {
          const url = await uploadFile(file);
          if (url) uploaded.push(url);
        }
        addUrlsToGallery(uploaded);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [addUrlsToGallery]
  );

  const setPrincipal = useCallback((foto: string) => {
    setPhotos((prev) =>
      prev.map((item) => ({
        ...item,
        is_principal: item.foto === foto,
      }))
    );
  }, []);

  const movePhoto = useCallback((index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next.map((entry, idx) => ({ ...entry, ordem: idx }));
    });
  }, []);

  const addManualUrl = useCallback(() => {
    const ref = manualUrl.trim();
    if (!ref) return;
    addUrlsToGallery([resolvePublicImageUrl(ref)]);
    setManualUrl("");
  }, [addUrlsToGallery, manualUrl]);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragActive(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files?.length) void uploadFiles(files);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) void uploadFiles(files);
  };

  const principal = photos.find((item) => item.is_principal) ?? photos[0] ?? null;
  const principalRef = principal?.foto ?? "";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
      <h2 className="text-base font-bold text-gray-900">Fotos da galeria</h2>
      <input type="hidden" name="foto" value={principalRef} readOnly />
      <input type="hidden" name="fotos_json" value={JSON.stringify(photos)} readOnly />

      {photos.length > 0 && (
        <ul className="mt-4 list-none space-y-2 p-0" aria-label="Imagens do produto">
          {photos.map((item, index) => {
            const resolvedListSrc = resolvePublicImageUrl(item.foto);
            const removing = removingFoto === item.foto;
            return (
              <li
                key={item.foto}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex shrink-0 justify-center sm:justify-start">
                  <img
                    src={resolvedListSrc}
                    alt=""
                    className="h-24 w-24 rounded-md border border-gray-200 bg-white object-contain shadow-sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {item.is_principal ? "Foto principal" : `Foto complementar #${index + 1}`}
                  </p>
                  <p className="mt-0.5 break-all text-sm text-gray-800" title={item.foto}>
                    {item.foto}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  <button
                    type="button"
                    disabled={uploading || removing || item.is_principal}
                    onClick={() => setPrincipal(item.foto)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Principal
                  </button>
                  <div className="flex gap-2 sm:justify-end">
                    <button
                      type="button"
                      disabled={uploading || index === 0}
                      onClick={() => movePhoto(index, -1)}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={uploading || index === photos.length - 1}
                      onClick={() => movePhoto(index, 1)}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={uploading || removing}
                    onClick={() => void handleExcluirImagem(item.foto)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {removing ? "Removendo…" : "Excluir"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition outline-none focus-visible:ring-2 focus-visible:ring-[#1d63ed]/30 sm:min-h-[200px] ${
          dragActive ? "border-admin-accent bg-[#1d63ed]/15" : "border-admin-accent bg-[#1d63ed]/[0.06]"
        } ${uploading ? "pointer-events-none opacity-70" : ""}`}
        aria-label="Área para arrastar ou selecionar fotos do produto"
      >
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFileChange}
        />

        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm"
          style={{ backgroundColor: ACCENT }}
          aria-hidden
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <p className="mt-4 max-w-xs text-center text-sm font-medium sm:max-w-md" style={{ color: ACCENT }}>
          {uploading ? "Enviando imagens..." : "Arraste e solte, ou selecione uma ou mais fotos do produto"}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="foto_manual" className="text-sm font-medium text-gray-700">
            URL ou caminho manual
          </label>
          <input
            id="foto_manual"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            className={`${fieldClass} mt-1 w-full`}
            placeholder="Ex.: https://… ou product-images/produtos/…"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={addManualUrl}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Adicionar URL
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
          <path d="M21 15l-5-5-4 4-2-2-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p>Padrão: 1200x1200px (autoajuste para PNG/JPEG/WEBP) / GIF precisa já estar em 1200x1200</p>
      </div>
    </div>
  );
}
