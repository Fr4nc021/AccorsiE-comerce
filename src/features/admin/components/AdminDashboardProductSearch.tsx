"use client";

import Link from "next/link";
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

/** Busca de produtos: atualiza `?q=` na rota atual com debounce. */
export function AdminDashboardProductSearch() {
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

  const hasFilter = Boolean(urlQ.trim());

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center sm:gap-3">
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          value={value}
          onChange={onChange}
          placeholder="Buscar por nome ou código"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-4 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none ring-0 transition focus:border-admin-accent/40 focus:ring-2 focus:ring-admin-accent/20"
          aria-label="Buscar produto na lista"
          autoComplete="off"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
          <IconSearch className="h-5 w-5" />
        </span>
      </div>
      {hasFilter && (
        <Link
          href={(() => {
            const p = new URLSearchParams(sp.toString());
            p.delete("q");
            const qs = p.toString();
            return qs ? `${pathname}?${qs}` : pathname;
          })()}
          className="shrink-0 text-center text-sm font-medium text-admin-accent underline-offset-2 hover:underline"
        >
          Limpar busca
        </Link>
      )}
    </div>
  );
}
