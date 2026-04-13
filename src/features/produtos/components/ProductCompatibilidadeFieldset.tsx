"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ModeloOption = {
  id: string;
  nome: string;
  marca_nome: string;
  /** Anos cadastrados em «Marcas e modelos» (modelo_anos), ordenados. */
  anos_referencia: number[];
};

export type CompatRowState = {
  key: string;
  modelo_id: string;
  ano_inicio: string;
  ano_fim: string;
};

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

function newKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyRow(): CompatRowState {
  return { key: newKey(), modelo_id: "", ano_inicio: "", ano_fim: "" };
}

function sortedUniqueInts(nums: number[]): number[] {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function hasContiguousInSet(set: Set<number>, ini: number, fim: number): boolean {
  if (ini > fim) return false;
  for (let y = ini; y <= fim; y++) {
    if (!set.has(y)) return false;
  }
  return true;
}

/** Anos válidos como fim da faixa, dado o início (todos os anos do intervalo existem no catálogo). */
function fimChoicesParaInicio(anosCatalog: number[], inicio: number): number[] {
  const sorted = sortedUniqueInts(anosCatalog);
  const set = new Set(sorted);
  return sorted.filter((fim) => fim >= inicio && hasContiguousInSet(set, inicio, fim));
}

function inicioChoices(anosCatalog: number[]): number[] {
  const sorted = sortedUniqueInts(anosCatalog);
  return sorted.filter((ini) => fimChoicesParaInicio(anosCatalog, ini).length > 0);
}

/** Garante que o valor atual apareça no select mesmo fora da lista ideal (ex.: edição legada). */
function withSelectedValue(opts: number[], raw: string): number[] {
  const n = Number.parseInt(raw, 10);
  if (raw === "" || Number.isNaN(n)) return opts;
  if (opts.includes(n)) return opts;
  return sortedUniqueInts([...opts, n]);
}

export function rowsToCompatJson(rows: CompatRowState[]): string {
  const payload = rows.map(({ modelo_id, ano_inicio, ano_fim }) => ({
    modelo_id: modelo_id.trim(),
    ano_inicio: ano_inicio.trim(),
    ano_fim: ano_fim.trim(),
  }));
  return JSON.stringify(payload);
}

export function compatRowsFromServer(
  list: { modelo_id: string; ano_inicio: string; ano_fim: string }[]
): CompatRowState[] {
  if (list.length === 0) return [emptyRow()];
  return list.map((r) => ({
    key: newKey(),
    modelo_id: r.modelo_id,
    ano_inicio: r.ano_inicio,
    ano_fim: r.ano_fim,
  }));
}

export function ProductCompatibilidadeFieldset({
  modelos,
  initialRows,
  replaceOnSave,
}: {
  modelos: ModeloOption[];
  initialRows?: { modelo_id: string; ano_inicio: string; ano_fim: string }[];
  /** Na edição: avisa que a lista enviada substitui todas as compatibilidades gravadas. */
  replaceOnSave?: boolean;
}) {
  const [rows, setRows] = useState<CompatRowState[]>(() =>
    initialRows && initialRows.length > 0 ? compatRowsFromServer(initialRows) : [emptyRow()]
  );

  const modelosById = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos]);

  const compatJson = useMemo(() => rowsToCompatJson(rows), [rows]);

  function addRow() {
    setRows((r) => [...r, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((r) => {
      const next = r.filter((x) => x.key !== key);
      return next.length === 0 ? [emptyRow()] : next;
    });
  }

  function patchRow(key: string, patch: Partial<Omit<CompatRowState, "key">>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="rounded-xl border border-gray-200 bg-gray-50/40 p-4">
      <legend className="px-1 text-sm font-medium text-gray-800">Compatibilidade (opcional)</legend>
      <p className="mb-3 text-xs text-gray-500">
        Para cada modelo, escolha apenas anos já cadastrados como referência desse veículo em{" "}
        <Link href="/admin/marcas-e-modelos" className="font-medium text-admin-accent hover:underline">
          Marcas e modelos
        </Link>
        . A faixa não pode incluir um ano que não exista na lista do modelo.
      </p>
      {replaceOnSave && (
        <p className="mb-3 text-xs text-gray-600">
          Ao salvar, esta lista substitui toda a compatibilidade já cadastrada. Para remover todas,
          deixe apenas linhas em branco.
        </p>
      )}
      <input type="hidden" name="compat_json" value={compatJson} aria-hidden />

      <ul className="flex flex-col gap-4">
        {rows.map((row, index) => {
          const modelo = row.modelo_id ? modelosById.get(row.modelo_id) : undefined;
          const anos = modelo?.anos_referencia ?? [];
          const semAnos = Boolean(row.modelo_id && anos.length === 0);
          const inicioBase = inicioChoices(anos);
          const iniNum = Number.parseInt(row.ano_inicio, 10);
          const fimBase =
            row.ano_inicio !== "" && !Number.isNaN(iniNum)
              ? fimChoicesParaInicio(anos, iniNum)
              : [];
          const inicioOpts = withSelectedValue(inicioBase, row.ano_inicio);
          const fimOpts = withSelectedValue(fimBase, row.ano_fim);

          return (
            <li
              key={row.key}
              className="rounded-lg border border-gray-200/80 bg-white/80 p-3 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Modelo {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Remover
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700" htmlFor={`modelo-${row.key}`}>
                    Modelo
                  </label>
                  <select
                    id={`modelo-${row.key}`}
                    className={fieldClass}
                    value={row.modelo_id}
                    onChange={(e) => {
                      const modelo_id = e.target.value;
                      patchRow(row.key, { modelo_id, ano_inicio: "", ano_fim: "" });
                    }}
                  >
                    <option value="">— Nenhum —</option>
                    {modelos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.marca_nome} — {m.nome}
                        {m.anos_referencia.length === 0 ? " (sem anos cadastrados)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {semAnos && (
                  <p className="text-xs text-amber-800">
                    Este modelo não tem anos de referência. Cadastre-os em{" "}
                    <Link href="/admin/marcas-e-modelos" className="font-medium underline hover:no-underline">
                      Marcas e modelos
                    </Link>{" "}
                    antes de vincular aqui.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700" htmlFor={`ini-${row.key}`}>
                      Ano inicial
                    </label>
                    <select
                      id={`ini-${row.key}`}
                      className={fieldClass}
                      disabled={!row.modelo_id || anos.length === 0}
                      value={row.ano_inicio}
                      onChange={(e) => {
                        const ano_inicio = e.target.value;
                        const nextIni = Number.parseInt(ano_inicio, 10);
                        let ano_fim = row.ano_fim;
                        if (ano_inicio !== "" && !Number.isNaN(nextIni)) {
                          const fims = fimChoicesParaInicio(anos, nextIni);
                          const f = Number.parseInt(ano_fim, 10);
                          if (ano_fim === "" || Number.isNaN(f) || !fims.includes(f)) {
                            ano_fim = "";
                          }
                        } else {
                          ano_fim = "";
                        }
                        patchRow(row.key, { ano_inicio, ano_fim });
                      }}
                    >
                      <option value="">— Ano —</option>
                      {inicioOpts.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700" htmlFor={`fim-${row.key}`}>
                      Ano final
                    </label>
                    <select
                      id={`fim-${row.key}`}
                      className={fieldClass}
                      disabled={!row.modelo_id || anos.length === 0 || row.ano_inicio === ""}
                      value={row.ano_fim}
                      onChange={(e) => patchRow(row.key, { ano_fim: e.target.value })}
                    >
                      <option value="">— Ano —</option>
                      {fimOpts.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 w-full rounded-lg border border-dashed border-gray-300 bg-white/60 py-2 text-sm font-medium text-gray-700 transition hover:border-admin-accent hover:bg-[#1d63ed]/5 hover:text-admin-accent"
      >
        + Adicionar outro modelo
      </button>
    </fieldset>
  );
}
