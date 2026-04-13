"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { parseProductImageStoragePath } from "@/services/storage/productImagePath";

const ACCENT = "#1d63ed";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
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

type ProductPhotoPanelProps = {
  /** Valor inicial (edição) ou vazio (novo produto). */
  initialFoto?: string;
};

export function ProductPhotoPanel({ initialFoto = "" }: ProductPhotoPanelProps) {
  const [fotoUrl, setFotoUrl] = useState(() => initialFoto.trim());
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    setFotoUrl(initialFoto.trim());
  }, [initialFoto]);

  const revokePreview = useCallback(() => {
    if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc);
  }, [previewSrc]);

  const clearFile = useCallback(() => {
    revokePreview();
    setPreviewSrc(null);
    setFotoUrl("");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }, [revokePreview]);

  const removeStorageObjectForRef = async (ref: string) => {
    const bucket = productImagesBucket();
    const path = parseProductImageStoragePath(ref, bucket);
    if (!path) return;
    const { error } = await createClient().storage.from(bucket).remove([path]);
    if (error && !/not found|No such file|404/i.test(error.message)) {
      throw new Error(error.message);
    }
  };

  const handleExcluirImagem = async () => {
    const ref = fotoUrl.trim();
    if (!ref) return;
    setError(null);
    setRemoving(true);
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
      clearFile();
    } finally {
      setRemoving(false);
    }
  };

  const uploadFile = async (file: File) => {
    setError(null);
    if (!ALLOWED_MIME.has(file.type)) {
      setError("Use JPEG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Arquivo muito grande (máximo 5 MB).");
      return;
    }

    const previousFoto = fotoUrl;
    revokePreview();
    const blobUrl = URL.createObjectURL(file);
    setPreviewSrc(blobUrl);
    setUploading(true);

    try {
      const supabase = createClient();
      const bucket = productImagesBucket();
      const ext = EXT_FROM_MIME[file.type] ?? "jpg";
      const path = `produtos/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
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

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);

      URL.revokeObjectURL(blobUrl);
      setPreviewSrc(null);
      setFotoUrl(publicUrl);

      const oldRef = previousFoto.trim();
      if (oldRef && oldRef !== publicUrl) {
        try {
          await removeStorageObjectForRef(oldRef);
        } catch {
          /* imagem antiga pode permanecer no bucket */
        }
      }
    } catch (e) {
      URL.revokeObjectURL(blobUrl);
      setPreviewSrc(null);
      setFotoUrl(previousFoto);
      setError(e instanceof Error ? e.message : "Falha no envio da imagem.");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setUploading(false);
    }
  };

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
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  };

  const hasListedImage = fotoUrl.trim() !== "" && !uploading;
  const resolvedListSrc = hasListedImage ? resolvePublicImageUrl(fotoUrl) : "";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
      <h2 className="text-base font-bold text-gray-900">Fotos e vídeo</h2>

      {manualEntry ? (
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor="foto_manual" className="text-sm font-medium text-gray-700">
            URL ou caminho da imagem
          </label>
          <input
            id="foto_manual"
            name="foto"
            value={fotoUrl}
            onChange={(e) => setFotoUrl(e.target.value)}
            className={fieldClass}
            placeholder="Ex.: https://… ou product-images/produtos/…"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setManualEntry(false)}
            className="self-start text-sm font-medium text-admin-accent hover:underline"
          >
            Usar arrastar e soltar
          </button>
        </div>
      ) : (
        <>
          <input type="hidden" name="foto" value={fotoUrl} readOnly />

          {hasListedImage && (
            <ul className="mt-4 list-none space-y-2 p-0" aria-label="Imagens do produto">
              <li className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 sm:flex-row sm:items-center">
                <div className="flex shrink-0 justify-center sm:justify-start">
                  <img
                    src={resolvedListSrc}
                    alt=""
                    className="h-24 w-24 rounded-md border border-gray-200 bg-white object-contain shadow-sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Imagem atual
                  </p>
                  <p className="mt-0.5 break-all text-sm text-gray-800" title={fotoUrl}>
                    {fotoUrl}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => void handleExcluirImagem()}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {removing ? "Removendo…" : "Excluir imagem"}
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Carregar nova
                  </button>
                </div>
              </li>
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
              dragActive
                ? "border-admin-accent bg-[#1d63ed]/15"
                : "border-admin-accent bg-[#1d63ed]/[0.06]"
            } ${uploading ? "pointer-events-none opacity-70" : ""}`}
            aria-label="Área para arrastar ou selecionar foto do produto"
          >
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onFileChange}
            />

            {previewSrc && uploading ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={previewSrc}
                  alt=""
                  className="max-h-32 w-auto max-w-full rounded-md object-contain opacity-80"
                />
                <p className="text-sm text-gray-600">Enviando…</p>
              </div>
            ) : previewSrc && !uploading && !hasListedImage ? (
              <div className="flex w-full max-w-sm flex-col items-center gap-3">
                <img
                  src={previewSrc}
                  alt="Pré-visualização"
                  className="max-h-40 w-auto max-w-full rounded-md object-contain shadow-sm"
                />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      fileRef.current?.click();
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Trocar imagem
                  </button>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      clearFile();
                    }}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                <p
                  className="mt-4 max-w-xs text-center text-sm font-medium sm:max-w-md"
                  style={{ color: ACCENT }}
                >
                  {hasListedImage
                    ? "Arraste ou selecione uma nova imagem para substituir a atual"
                    : "Arraste e solte, ou selecione fotos do produto"}
                </p>
              </>
            )}
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
            <p>
              Tamanho mínimo recomendado: 1280px / Formatos recomendados: WEBP, PNG, JPEG ou GIF
            </p>
          </div>

          <button
            type="button"
            onClick={() => setManualEntry(true)}
            className="mt-3 text-sm font-medium text-admin-accent hover:underline"
          >
            Ou informe URL ou caminho manualmente
          </button>
        </>
      )}
    </div>
  );
}
