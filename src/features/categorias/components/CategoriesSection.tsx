import Image from "next/image";
import Link from "next/link";
import type { CategoryListItem } from "@/types/category";

export type { CategoryListItem };

type CategoriesSectionProps = {
  categorias: CategoryListItem[];
};

function normalizeIconSrc(icone: string | null): string | null {
  if (!icone?.trim()) return null;
  const t = icone.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return t.startsWith("/") ? t : `/${t}`;
}

const headingId = "home-categories-heading";

const MAX_CATEGORIAS = 10;

export function CategoriesSection({ categorias }: CategoriesSectionProps) {
  const visiveis = categorias.slice(0, MAX_CATEGORIAS);

  if (visiveis.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-store-line/70 bg-white/50 px-6 py-10 text-center text-sm text-store-navy-muted"
        role="status"
      >
        Em breve as categorias aparecerão aqui.
      </div>
    );
  }

  return (
    <div aria-labelledby={headingId}>
      <h2 id={headingId} className="text-center text-lg font-bold text-store-navy sm:text-xl">
        Categorias
      </h2>
      <ul className="mt-6 flex w-full flex-wrap justify-center gap-3">
        {visiveis.map((c) => {
          const src = normalizeIconSrc(c.icone);
          const href = `/produtos?categorias=${encodeURIComponent(c.id)}`;
          return (
            <li
              key={c.id}
              className="w-[calc((100%-1.5rem)/3)] shrink-0 lg:w-[calc((100%-6.75rem)/10)]"
            >
              <Link
                href={href}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border border-store-line/80 bg-white px-3 py-4 text-center shadow-sm transition hover:border-store-navy/25 hover:shadow-md"
              >
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden text-lg font-semibold text-store-navy">
                  {src ? (
                    <Image
                      src={src}
                      alt=""
                      width={56}
                      height={56}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="text-store-accent" aria-hidden>
                      {c.nome.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-xs font-semibold leading-snug text-store-navy sm:text-sm">
                  {c.nome}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
