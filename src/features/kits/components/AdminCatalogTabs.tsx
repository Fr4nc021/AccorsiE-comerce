import Link from "next/link";

export function AdminCatalogTabs({ active }: { active: "produtos" | "kits" }) {
  const base =
    "rounded-lg px-4 py-2 text-sm font-semibold transition";
  const on = "bg-admin-accent text-white shadow-sm";
  const off = "bg-gray-100 text-gray-700 hover:bg-gray-200";

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Catálogo">
      <Link
        href="/admin/produtos"
        role="tab"
        aria-selected={active === "produtos"}
        className={[base, active === "produtos" ? on : off].join(" ")}
      >
        Produtos
      </Link>
      <Link
        href="/admin/kits"
        role="tab"
        aria-selected={active === "kits"}
        className={[base, active === "kits" ? on : off].join(" ")}
      >
        Kits
      </Link>
    </div>
  );
}
