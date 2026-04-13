"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { storeShellContent, storeShellInset } from "@/config/storeShell";
import {
  buildCatalogQueryString,
  parseCatalogSearchParamsFromUrlSearchParams,
} from "@/features/produtos/utils/catalogSearchParams";
import type { CategoryListItem } from "@/types/category";

const LINK_NAV_AFTER_CATEGORIAS = [
  { href: "/produtos", label: "PRODUTOS" },
  { href: "/sobre", label: "SOBRE NÓS" },
] as const;

const ICON_GARAGE = "/icons/garagem%201.png";
const ICON_CART = "/icons/carrinho.png";
const ICON_PROFILE = "/icons/perfil.png";

const HOME_BANNER = "/home/Banner%20inicial.png";
const HOME_BANNER_W = 1920;
const HOME_BANNER_H = 262;

const HOME_LOGO = "/home/logo-removebg-preview%20%281%29.png";
const HOME_LOGO_W = 640;
const HOME_LOGO_H = 200;

/** Tamanho visual único dos ícones da barra (garagem, carrinho, perfil). */
const ICON_PX = 32;
const iconImgClass = "h-8 w-8 shrink-0 object-contain";

type StoreNavbarProps = {
  categorias: CategoryListItem[];
  catalogSliderMax: number;
};

function navLinkClass(active: boolean) {
  return [
    "shrink-0 text-sm font-bold uppercase tracking-wide transition-colors",
    "h-full flex items-end",
    active
      ? "border-b-2 border-store-navy text-store-navy"
      : "border-b-2 border-transparent text-store-navy-muted hover:text-store-accent",
  ].join(" ");
}

export function StoreNavbar({ categorias, catalogSliderMax }: StoreNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const showHomeBanner = pathname === "/";
  const [categoriasOpen, setCategoriasOpen] = useState(false);
  const categoriasWrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const closeCategorias = useCallback(() => setCategoriasOpen(false), []);

  useEffect(() => {
    if (!categoriasOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = categoriasWrapRef.current;
      if (el && !el.contains(e.target as Node)) closeCategorias();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCategorias();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [categoriasOpen, closeCategorias]);

  const applyCategoriaFilter = (categoriaId: string) => {
    closeCategorias();
    const onCatalog = pathname === "/produtos" || pathname.startsWith("/produtos/");
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const current = parseCatalogSearchParamsFromUrlSearchParams(params);
    const next = { ...current, categoriaIds: [categoriaId] };
    const qs = buildCatalogQueryString(next, catalogSliderMax);
    if (onCatalog) {
      router.replace(`/produtos${qs}`, { scroll: false });
    } else {
      router.push(`/produtos${qs}`);
    }
  };

  return (
    <header className="overflow-x-hidden bg-store-cream text-store-navy">
      <div className={storeShellInset}>
        <div className={storeShellContent}>
          <div className="px-4 sm:px-6 md:px-8 lg:px-10">
            <div className="flex items-center gap-4 py-4 sm:gap-6 lg:gap-10">
              <Link
                href="/"
                className="shrink-0 self-center rounded-sm outline-none ring-store-navy/30 focus-visible:ring-2"
                aria-label="Accorsi Auto Peças — início"
              >
                <Image
                  src={HOME_LOGO}
                  alt="Accorsi Auto Peças"
                  width={200}
                  height={64}
                  className="h-9 w-auto max-w-[9.5rem] object-contain object-left sm:h-11 sm:max-w-[11rem]"
                  sizes="(max-width: 640px) 9.5rem, 11rem"
                  unoptimized
                />
              </Link>
              <nav
                className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-8 lg:gap-x-10 xl:gap-12"
                aria-label="Principal"
              >
                <Link href="/" className={navLinkClass(pathname === "/")}>
                  INÍCIO
                </Link>

                <div ref={categoriasWrapRef} className="relative shrink-0">
                  <button
                    type="button"
                    className={navLinkClass(categoriasOpen)}
                    aria-expanded={categoriasOpen}
                    aria-haspopup="listbox"
                    aria-controls={categoriasOpen ? listboxId : undefined}
                    onClick={() => setCategoriasOpen((v) => !v)}
                  >
                    CATEGORIAS
                  </button>
                  {categoriasOpen ? (
                    <div
                      id={listboxId}
                      role="listbox"
                      aria-label="Categorias"
                      className="store-nav-categorias-dropdown absolute left-1/2 top-full z-50 mt-1 min-w-[12rem] max-w-[min(calc(100vw-2rem),18rem)] -translate-x-1/2 rounded-sm border border-store-line/80 bg-white py-1 shadow-lg sm:left-0 sm:translate-x-0"
                    >
                      {categorias.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-store-navy-muted">Nenhuma categoria cadastrada.</p>
                      ) : (
                        <ul className="max-h-[min(70vh,20rem)] overflow-y-auto py-0.5">
                          {categorias.map((c) => (
                            <li key={c.id} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={false}
                                className="flex w-full items-center px-3 py-2 text-left text-sm font-medium text-store-navy transition hover:bg-store-subtle/90"
                                onClick={() => applyCategoriaFilter(c.id)}
                              >
                                {c.nome}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>

                {LINK_NAV_AFTER_CATEGORIAS.map(({ href, label }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link key={href} href={href} className={navLinkClass(active)}>
                      {label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex shrink-0 items-center gap-3 sm:gap-5">
                <button
                  type="button"
                  className="flex max-w-[min(100%,16rem)] items-center gap-2.5 rounded-full border border-store-line bg-store-subtle px-2.5 py-2 text-left transition hover:border-store-navy-muted/50 sm:max-w-none sm:gap-3 sm:px-4"
                >
                  <Image
                    src={ICON_GARAGE}
                    alt=""
                    width={ICON_PX}
                    height={ICON_PX}
                    className={iconImgClass}
                  />
                  <span className="min-w-0 leading-tight">
                    <span className="block text-sm font-bold text-store-navy">Minha Garagem</span>
                    <span className="hidden text-xs font-normal text-store-navy-muted sm:block">
                      Adicione seu veículo
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-black/[0.04]"
                  aria-label="Carrinho"
                >
                  <Image
                    src={ICON_CART}
                    alt=""
                    width={ICON_PX}
                    height={ICON_PX}
                    className={iconImgClass}
                  />
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-black/[0.04]"
                  aria-label="Conta"
                >
                  <Image
                    src={ICON_PROFILE}
                    alt=""
                    width={ICON_PX}
                    height={ICON_PX}
                    className={iconImgClass}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="mx-auto h-0.5 w-3/4 bg-store-navy" />

          {showHomeBanner ? (
            <div className="relative left-1/2 mt-3 w-screen max-w-[100vw] -translate-x-1/2 bg-store-navy sm:mt-4">
              <div className="relative mx-auto flex w-full max-w-[1920px] justify-center">
                <Image
                  src={HOME_BANNER}
                  alt="Accorsi Auto Peças — banner"
                  width={HOME_BANNER_W}
                  height={HOME_BANNER_H}
                  className="h-auto w-full object-contain"
                  style={{ maxWidth: HOME_BANNER_W }}
                  priority
                  sizes="100vw"
                  unoptimized
                />
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 flex w-[min(32%,22rem)] items-center justify-center px-2 sm:w-[min(30%,26rem)] sm:px-3"
                  aria-hidden
                >
                  <Image
                    src={HOME_LOGO}
                    alt=""
                    width={HOME_LOGO_W}
                    height={HOME_LOGO_H}
                    className="h-auto max-h-[min(44vw,8.5rem)] w-full max-w-full object-contain object-center sm:max-h-[min(9vw,9.5rem)]"
                    sizes="(max-width: 768px) 32vw, 22rem"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
