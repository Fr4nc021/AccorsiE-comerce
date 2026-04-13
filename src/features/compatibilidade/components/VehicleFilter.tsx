"use client";

import Image from "next/image";
import { Suspense, useId, useState } from "react";

import { storeShellContent, storeShellInset } from "@/config/storeShell";
import { StoreProductSearchBar } from "@/components/store/StoreProductSearchBar";

type VehicleCategory = "motos" | "carros" | "caminhoes";

const TABS: { id: VehicleCategory; label: string }[] = [
  { id: "motos", label: "Motos" },
  { id: "carros", label: "Carros" },
  { id: "caminhoes", label: "Caminhões" },
];

const TAB_ICON_SRC: Record<VehicleCategory, string> = {
  motos: "/home/filtro/moto.png",
  carros: "/home/filtro/carro.png",
  caminhoes: "/home/filtro/caminhao.png",
};

const TAB_ICON_PX = 40;

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const selectClass =
  "w-full appearance-none rounded-xl border border-store-line/80 bg-store-subtle px-3.5 py-2.5 pr-10 text-sm text-store-navy shadow-sm outline-none transition focus:border-store-navy-muted focus:ring-2 focus:ring-store-navy/20";

const tabIndex = (id: VehicleCategory) => TABS.findIndex((t) => t.id === id);

export function VehicleFilter() {
  const [category, setCategory] = useState<VehicleCategory>("carros");
  const baseId = useId();
  const activeTabIndex = tabIndex(category);

  return (
    <section
      className={`${storeShellInset} pb-2 pt-6 sm:pt-8`}
      aria-labelledby={`${baseId}-heading`}
    >
      <div className={storeShellContent}>
        <div className="mx-auto max-w-4xl">
          <h2
            id={`${baseId}-heading`}
            className="text-center text-lg font-bold text-store-navy sm:text-xl"
          >
            Filtre a sua busca
          </h2>

          <div
            className="mt-5 rounded-full border border-store-line bg-white p-1 shadow-sm"
            role="tablist"
            aria-label="Tipo de veículo"
          >
            <div className="relative flex">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/3 rounded-full bg-store-navy shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{ transform: `translateX(calc(${activeTabIndex} * 100%))` }}
              />
            {TABS.map(({ id, label }) => {
              const active = category === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(id)}
                  className={[
                    "relative z-10 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-2 py-2 text-sm font-semibold transition-colors duration-200 sm:px-4",
                    active ? "text-store-accent" : "text-store-navy hover:bg-store-subtle/70",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "relative block h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]",
                      !active && "opacity-90",
                    ].join(" ")}
                    aria-hidden
                  >
                    {active ? (
                      <span
                        className="absolute inset-0 bg-store-accent"
                        style={{
                          WebkitMaskImage: `url(${TAB_ICON_SRC[id]})`,
                          WebkitMaskSize: "contain",
                          WebkitMaskRepeat: "no-repeat",
                          WebkitMaskPosition: "center",
                          maskImage: `url(${TAB_ICON_SRC[id]})`,
                          maskSize: "contain",
                          maskRepeat: "no-repeat",
                          maskPosition: "center",
                        }}
                      />
                    ) : (
                      <Image
                        src={TAB_ICON_SRC[id]}
                        alt=""
                        width={TAB_ICON_PX}
                        height={TAB_ICON_PX}
                        className="h-full w-full object-contain object-center"
                        unoptimized
                      />
                    )}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-store-navy px-4 py-5 shadow-md sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
              <div className="grid flex-1 gap-4 sm:grid-cols-3">
                <div className="min-w-0">
                  <label
                    htmlFor={`${baseId}-marca`}
                    className="mb-1.5 block text-sm font-medium text-white"
                  >
                    Marca
                  </label>
                  <div className="relative">
                    <select id={`${baseId}-marca`} className={selectClass} defaultValue="">
                      <option value="">Selecione</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-store-navy-muted">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M2.5 4.25 6 7.75 9.5 4.25"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor={`${baseId}-modelo`}
                    className="mb-1.5 block text-sm font-medium text-white"
                  >
                    Modelo
                  </label>
                  <div className="relative">
                    <select id={`${baseId}-modelo`} className={selectClass} defaultValue="">
                      <option value="">Selecione</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-store-navy-muted">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M2.5 4.25 6 7.75 9.5 4.25"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor={`${baseId}-ano`}
                    className="mb-1.5 block text-sm font-medium text-white"
                  >
                    Ano
                  </label>
                  <div className="relative">
                    <select id={`${baseId}-ano`} className={selectClass} defaultValue="">
                      <option value="">Selecione</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-store-navy-muted">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M2.5 4.25 6 7.75 9.5 4.25"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:shrink-0 lg:pb-0.5">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-store-subtle text-store-navy shadow-sm transition hover:bg-white"
                  aria-label="Buscar por veículo (em breve)"
                  title="Busca em breve"
                >
                  <IconSearch className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="relative mx-auto mt-4 w-1/2 min-w-0 max-w-full">
            <Suspense
              fallback={
                <div className="h-12 w-full animate-pulse rounded-full bg-[#3a3a3a]/50" aria-hidden />
              }
            >
              <StoreProductSearchBar />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
