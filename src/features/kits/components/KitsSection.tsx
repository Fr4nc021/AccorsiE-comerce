import { KitCard } from "@/features/kits/components/KitCard";
import { storeShellContent, storeShellInset } from "@/config/storeShell";
import type { KitSummary } from "@/types/kit";

export function KitsSection({
  kits,
  title = "Kits",
  emptyMessage,
  embedded = false,
}: {
  kits: KitSummary[];
  title?: string;
  emptyMessage?: string;
  /** When true, skip page shell padding (already inside a content container). */
  embedded?: boolean;
}) {
  if (kits.length === 0 && !emptyMessage) return null;

  const body = (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-store-navy md:text-3xl">{title}</h2>
      </div>
      {kits.length === 0 ? (
        <p className="text-sm text-store-navy/70">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
          {kits.map((kit) => (
            <KitCard key={kit.id} kit={kit} />
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <section className="space-y-5">{body}</section>;
  }

  return (
    <section className={`${storeShellInset} py-10 md:py-14`}>
      <div className={storeShellContent}>{body}</div>
    </section>
  );
}
