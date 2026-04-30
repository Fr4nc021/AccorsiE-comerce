"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { ModeloTableRow } from "@/features/compatibilidade/components/ModeloTableRow";
import { deleteModelosEmLote } from "@/features/compatibilidade/services/modeloActions";

export type ModeloListagemItem = {
  modeloId: string;
  nome: string;
  tipoVeiculo: string | null;
  marcaNome: string;
  anos: { id: string; ano: number }[];
  modeloAnosError: boolean;
};

export function ModelosListagemTabela({ items }: { items: ModeloListagemItem[] }) {
  const visibleIds = useMemo(() => items.map((i) => i.modeloId), [items]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const selectedInView = useMemo(() => visibleIds.filter((id) => selected.has(id)), [visibleIds, selected]);

  const allSelected = visibleIds.length > 0 && selectedInView.length === visibleIds.length;
  const someSelected = selectedInView.length > 0 && !allSelected;

  useLayoutEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someSelected;
  }, [someSelected, allSelected, visibleIds.length]);

  const toggleAll = useCallback(() => {
    setBulkMessage(null);
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(visibleIds));
  }, [allSelected, visibleIds]);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setBulkMessage(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const openBulkDeleteConfirm = () => {
    if (selectedInView.length === 0 || pending) return;
    setBulkDeleteConfirmOpen(true);
  };

  const runBulkDelete = () => {
    if (selectedInView.length === 0) return;
    const idsSnapshot = [...selectedInView];
    setBulkDeleteConfirmOpen(false);
    setBulkMessage(null);
    startTransition(async () => {
      const { removidos, falhas } = await deleteModelosEmLote(idsSnapshot);
      const failed = new Set(falhas.map((f) => f.id));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of idsSnapshot) {
          if (!failed.has(id)) next.delete(id);
        }
        return next;
      });
      if (removidos === 0 && falhas.length > 0) {
        setBulkMessage(falhas.map((f) => f.message).join(" "));
      } else if (falhas.length > 0) {
        setBulkMessage(
          `${removidos} removido(s). ${falhas.length} não puderam ser excluídos (ex.: dados vinculados).`
        );
      } else {
        setBulkMessage(`${removidos} modelo(s) removido(s).`);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleAll}
            disabled={pending || visibleIds.length === 0}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {allSelected ? "Desmarcar todos" : "Selecionar todos da listagem"}
          </button>
          <button
            type="button"
            onClick={openBulkDeleteConfirm}
            disabled={pending || selectedInView.length === 0}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
          >
            Apagar selecionados
            {selectedInView.length > 0 ? ` (${selectedInView.length})` : ""}
          </button>
        </div>
        <p className="text-[11px] text-gray-500">
          Reflete só os modelos visíveis com marca e busca atuais.
        </p>
      </div>
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Fechar confirmação"
            className="absolute inset-0 bg-black/50"
            onClick={() => !pending && setBulkDeleteConfirmOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-modelos-title"
            aria-describedby="bulk-delete-modelos-desc"
          >
            <h3 id="bulk-delete-modelos-title" className="text-base font-semibold text-gray-900">
              Tem certeza?
            </h3>
            <p id="bulk-delete-modelos-desc" className="mt-2 text-sm text-gray-600">
              Você vai excluir <strong>{selectedInView.length}</strong> modelo
              {selectedInView.length === 1 ? "" : "s"} visíve
              {selectedInView.length === 1 ? "l" : "is"} nesta listagem (marca e busca atuais). Compatibilidades de
              produtos e anos de referência ligados{" "}
              {selectedInView.length === 1 ? "a ele serão impactados" : "a eles serão impactados"}.{" "}
              <span className="font-medium text-gray-800">Esta ação não pode ser desfeita.</span>
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                disabled={pending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runBulkDelete}
                disabled={pending}
                className="rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkMessage && (
        <p className="px-4 text-xs text-gray-700" role="status">
          {bulkMessage}
        </p>
      )}
      <div className="max-h-[min(55vh,22rem)] overflow-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b border-gray-100 bg-gray-50/95 text-[10px] font-semibold uppercase tracking-wide text-gray-500 backdrop-blur-sm">
              <th className="w-[1%] px-3 py-2">
                <span className="sr-only">Seleção em massa</span>
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={pending || visibleIds.length === 0}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-admin-accent focus:ring-admin-accent"
                  aria-label="Selecionar ou desmarcar todos os modelos da listagem"
                />
              </th>
              <th className="px-4 py-2">Marca</th>
              <th className="px-4 py-2">Modelo</th>
              <th className="whitespace-nowrap px-4 py-2">Tipo</th>
              <th className="min-w-[12rem] px-4 py-2">Anos de referência</th>
              <th className="w-[1%] px-3 py-2 text-right font-semibold normal-case tracking-normal">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((m) => (
              <ModeloTableRow
                key={m.modeloId}
                modeloId={m.modeloId}
                nome={m.nome}
                tipoVeiculo={m.tipoVeiculo}
                marcaNome={m.marcaNome}
                anos={m.anos}
                modeloAnosError={m.modeloAnosError}
                bulkCheckbox={{
                  checked: selected.has(m.modeloId),
                  onChange: (checked) => toggleOne(m.modeloId, checked),
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
