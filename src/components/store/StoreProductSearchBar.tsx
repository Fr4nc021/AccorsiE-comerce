"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

const DEBOUNCE_MS = 350;

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

type StoreProductSearchBarProps = {
  /** Classes no wrapper externo (largura, alinhamento). */
  className?: string;
};

/**
 * Busca de produtos: atualiza `?q=` na URL (home ou /produtos) com debounce,
 * no mesmo estilo visual da home (fundo escuro).
 */
export function StoreProductSearchBar({ className }: StoreProductSearchBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const urlQ = sp.get("q") ?? "";
  const [value, setValue] = useState(urlQ);
  const lastPushedRef = useRef<string | null>(urlQ || null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const current = sp.get("q") ?? "";
    setValue((prev) => {
      if (prev === current) return prev;
      if (lastPushedRef.current === current) return prev;
      lastPushedRef.current = current || null;
      return current;
    });
  }, [sp]);

  const pushUrl = useCallback(
    (nextQ: string) => {
      const t = nextQ.trim();
      const currentInUrl = (sp.get("q") ?? "").trim();
      if (t === currentInUrl) return;

      const p = new URLSearchParams(sp.toString());
      if (t) p.set("q", t);
      else p.delete("q");
      const qs = p.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      lastPushedRef.current = t || null;
      router.replace(href, { scroll: false });
    },
    [pathname, router, sp]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => pushUrl(v), DEBOUNCE_MS);
  };

  return (
    <div className={["relative min-w-0", className].filter(Boolean).join(" ")}>
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder="Buscar produtos"
        className="w-full rounded-full border border-transparent bg-[#3a3a3a] py-3.5 pl-5 pr-12 text-sm text-white placeholder:text-zinc-400 outline-none ring-0 transition focus:border-store-accent/40 focus:ring-2 focus:ring-store-accent/25"
        aria-label="Buscar produtos"
        autoComplete="off"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/90">
        <IconSearch className="h-5 w-5" />
      </span>
    </div>
  );
}
