"use client";

import { useState, useTransition } from "react";
import { deleteMarca, updateMarca } from "@/features/marcas/services/marcaActions";

const fieldClass =
  "w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

const iconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-50";

export function MarcaRow({ marca }: { marca: { id: string; nome: string } }) {
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(marca.nome);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancelEdit() {
    setNome(marca.nome);
    setEditing(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("id", marca.id);
    fd.set("nome", nome.trim());
    startTransition(async () => {
      const r = await updateMarca(fd);
      if (r.ok === false) {
        setError(r.message);
        return;
      }
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir a marca “${marca.nome}”? Esta ação não pode ser desfeita.`)) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteMarca(marca.id);
      if (r.ok === false) {
        setError(r.message);
      }
    });
  }

  return (
    <tr className="text-gray-900 transition hover:bg-gray-50/80">
      <td className="px-6 py-3.5">
        {editing ? (
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={fieldClass}
            disabled={pending}
            autoFocus
            aria-label="Nome da marca"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Escape") cancelEdit();
            }}
          />
        ) : (
          <span className="font-medium">{marca.nome}</span>
        )}
        {error && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </td>
      <td className="w-[1%] whitespace-nowrap px-4 py-3.5">
        <div className="flex items-center justify-end gap-0.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending}
                className={`${iconBtn} text-emerald-700 hover:bg-emerald-50`}
                aria-label="Salvar"
                title="Salvar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={pending}
                className={`${iconBtn} text-gray-600 hover:bg-gray-100`}
                aria-label="Cancelar edição"
                title="Cancelar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNome(marca.nome);
                  setEditing(true);
                }}
                disabled={pending}
                className={`${iconBtn} text-admin-accent hover:bg-[#1d63ed]/10`}
                aria-label="Editar marca"
                title="Editar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className={`${iconBtn} text-red-600 hover:bg-red-50`}
                aria-label="Excluir marca"
                title="Excluir"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
