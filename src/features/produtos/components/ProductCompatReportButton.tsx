"use client";

import { useState } from "react";

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

export function ProductCompatReportButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/produtos-compat-export");
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        throw new Error(body?.message ?? body?.error ?? "Falha ao gerar o relatório.");
      }

      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        filenameFromDisposition(response.headers.get("Content-Disposition")) ??
        "produtos-compatibilidades.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao gerar o relatório.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1 lg:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          void handleClick();
        }}
        title="Baixe os vínculos atuais antes de apagar os modelos"
        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Gerando…" : "Exportar compatibilidade"}
      </button>
      {error ? <p className="max-w-xs text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
