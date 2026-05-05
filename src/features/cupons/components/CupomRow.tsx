"use client";

import { useState, useTransition } from "react";

import { deleteCupom, updateCupom, type SaveCupomResult } from "@/features/cupons/services/cupomActions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const fieldClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-admin-accent focus:ring-2 focus:ring-[#1d63ed]/20";

export type CupomListRow = {
  id: string;
  codigo: string;
  tipo: "percent" | "fixed";
  valor: number;
  ativo: boolean;
  valido_ate: string | null;
  max_usos: number | null;
  usos_count: number;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatValor(row: CupomListRow): string {
  if (row.tipo === "percent") {
    return `${row.valor}%`;
  }
  return money.format(row.valor);
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CupomRow({ row }: { row: CupomListRow }) {
  const [editing, setEditing] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onDeleteConfirm() {
    startTransition(() => {
      void deleteCupom(row.id).then((r) => {
        if (!r.ok) {
          setMsg(r.message);
        }
      });
    });
  }

  return (
    <>
      <tr className="border-b border-gray-100">
        <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-900">{row.codigo}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{row.tipo === "percent" ? "Percentual" : "Valor fixo"}</td>
        <td className="px-4 py-3 text-sm tabular-nums text-gray-900">{formatValor(row)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">
          <span
            className={
              row.ativo ? "rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-900" : "rounded-full bg-gray-100 px-2 py-0.5 text-gray-600"
            }
          >
            {row.ativo ? "Ativo" : "Inativo"}
          </span>
        </td>
        <td className="px-4 py-3 text-sm tabular-nums text-gray-700">
          {row.usos_count}
          {row.max_usos != null ? ` / ${row.max_usos}` : ""}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing((e) => !e);
                setMsg(null);
              }}
              className="text-sm font-medium text-admin-accent hover:underline"
            >
              {editing ? "Fechar" : "Editar"}
            </button>
            <button
              type="button"
              onClick={() => setRemoveOpen(true)}
              className="text-sm font-medium text-red-700 hover:underline"
            >
              Excluir
            </button>
          </div>
        </td>
      </tr>
      {editing ? (
        <tr className="bg-gray-50/80">
          <td colSpan={6} className="px-4 py-4">
            <form
              action={async (formData) => {
                setMsg(null);
                const r: SaveCupomResult = await updateCupom(formData);
                if (!r.ok) {
                  setMsg(r.message);
                  return;
                }
                setEditing(false);
              }}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              <input type="hidden" name="id" value={row.id} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Código</label>
                <input name="codigo" required defaultValue={row.codigo} className={fieldClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Tipo</label>
                <select name="tipo" defaultValue={row.tipo} className={fieldClass}>
                  <option value="percent">Percentual</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Valor</label>
                <input
                  name="valor"
                  required
                  defaultValue={row.valor}
                  inputMode="decimal"
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Válido até (opcional)</label>
                <input
                  name="valido_ate"
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(row.valido_ate)}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Máximo de usos (opcional)</label>
                <input
                  name="max_usos"
                  type="number"
                  min={1}
                  defaultValue={row.max_usos ?? ""}
                  placeholder="Ilimitado"
                  className={fieldClass}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-800 md:col-span-3">
                <input type="checkbox" name="ativo" defaultChecked={row.ativo} className="h-4 w-4 rounded border-gray-300" />
                Ativo
              </label>
              {msg ? (
                <p className="text-sm text-red-700 md:col-span-3" role="alert">
                  {msg}
                </p>
              ) : null}
              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-semibold text-white hover:bg-[#1857d1] disabled:opacity-60"
                >
                  {pending ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </form>
          </td>
        </tr>
      ) : null}

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Excluir cupom?"
        description={`O código "${row.codigo}" será removido. Pedidos antigos mantêm o histórico.`}
        confirmLabel="Excluir"
        variant="danger"
        pending={pending}
        onConfirm={() => {
          setRemoveOpen(false);
          onDeleteConfirm();
        }}
      />
    </>
  );
}
