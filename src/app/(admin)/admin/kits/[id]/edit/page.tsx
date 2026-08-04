import Link from "next/link";
import { notFound } from "next/navigation";
import { KitEditForm, type KitEditValues } from "@/features/kits/components/KitEditForm";
import type { KitPickerProduct } from "@/features/kits/components/KitItemsPicker";
import { parseKitDiscountType } from "@/features/kits/utils/kitPricing";
import { parseKitStatus } from "@/features/kits/utils/kitStatus";
import { createClient } from "@/services/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("kits").select("nome").eq("id", id).maybeSingle();
    if (data?.nome) return { title: `${data.nome} | Editar kit | Admin` };
  } catch {
    /* ignore */
  }
  return { title: "Editar kit | Admin" };
}

export default async function EditKitPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [kitRes, itemsRes, productsRes] = await Promise.all([
    supabase
      .from("kits")
      .select(
        "id, nome, slug, descricao, imagem, tipo_desconto, valor_desconto, preco_final, seo_title, seo_description, status",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("kit_items").select("product_id, quantidade").eq("kit_id", id),
    supabase
      .from("produtos")
      .select("id, titulo, cod_produto, valor")
      .order("titulo"),
  ]);

  if (kitRes.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
        {kitRes.error.message}
      </div>
    );
  }
  if (!kitRes.data) notFound();

  const k = kitRes.data;
  const kit: KitEditValues = {
    id: k.id,
    nome: k.nome ?? "",
    slug: k.slug ?? "",
    descricao: k.descricao ?? "",
    imagem: k.imagem ?? "",
    tipo_desconto: parseKitDiscountType(k.tipo_desconto),
    valor_desconto: Number(k.valor_desconto) || 0,
    preco_final: k.preco_final != null ? Number(k.preco_final) : null,
    seo_title: k.seo_title ?? "",
    seo_description: k.seo_description ?? "",
    status: parseKitStatus(k.status),
    items: (itemsRes.data ?? []).map((row) => ({
      product_id: row.product_id,
      quantidade: Number(row.quantidade) || 1,
    })),
  };

  const products: KitPickerProduct[] = (productsRes.data ?? [])
    .filter((p) => p.titulo && p.valor != null)
    .map((p) => ({
      id: p.id,
      titulo: String(p.titulo),
      cod_produto: String(p.cod_produto ?? ""),
      valor: Number(p.valor),
    }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/admin/kits"
        className="inline-flex text-sm font-semibold text-admin-accent hover:underline"
      >
        ← Voltar aos kits
      </Link>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <KitEditForm kit={kit} products={products} />
      </div>
    </div>
  );
}
