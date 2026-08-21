"use client";

import { useState, type ReactNode } from "react";

type TabId = "geral" | "dimensoes" | "embalagem";

const tabs: { id: TabId; label: string }[] = [
  { id: "geral", label: "Dados gerais" },
  { id: "dimensoes", label: "Dimensões do produto" },
  { id: "embalagem", label: "Embalagem" },
];

export function ProductFormTabsLayout({
  geral,
  dimensoes,
  embalagem,
  activeTab,
  onTabChange,
}: {
  geral: ReactNode;
  dimensoes: ReactNode;
  embalagem: ReactNode;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}) {
  const [internalTab, setInternalTab] = useState<TabId>("geral");
  const tab = activeTab ?? internalTab;

  function changeTab(next: TabId) {
    if (activeTab === undefined) {
      setInternalTab(next);
    }
    onTabChange?.(next);
  }

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
        role="tablist"
        aria-label="Seções do cadastro"
      >
        {tabs.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => changeTab(id)}
              className={`flex-1 rounded-lg px-3.5 py-2 text-center text-sm font-medium transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[0.98] sm:px-4 ${
                active
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/80"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div hidden={tab !== "geral"} className="space-y-5" role="tabpanel">
        {geral}
      </div>
      <div hidden={tab !== "dimensoes"} className="space-y-5" role="tabpanel">
        {dimensoes}
      </div>
      <div hidden={tab !== "embalagem"} className="space-y-5" role="tabpanel">
        {embalagem}
      </div>
    </div>
  );
}
