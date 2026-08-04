import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KitBuyButton } from "@/features/kits/components/KitBuyButton";
import { getKitBySlug } from "@/features/kits/services/getKitBySlug";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { storeShellContent, storeShellInset } from "@/config/storeShell";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const kit = await getKitBySlug(slug);
  if (!kit) return { title: "Kit | Accorsi" };
  return {
    title: kit.seo_title?.trim() || `${kit.nome} | Kit`,
    description: kit.seo_description?.trim() || kit.descricao.slice(0, 160) || undefined,
  };
}

export default async function KitPage({ params }: PageProps) {
  const { slug } = await params;
  const kit = await getKitBySlug(slug);
  if (!kit) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-store-cream font-sans text-store-navy">
      <div className={`${storeShellInset} flex-1 py-8 md:py-12`}>
        <div className={`${storeShellContent} grid gap-8 lg:grid-cols-2 lg:gap-12`}>
          <div className="relative aspect-square overflow-hidden rounded-sm bg-white">
            {kit.imagem ? (
              <Image src={kit.imagem} alt="" fill className="object-cover" sizes="(max-width:1024px) 100vw, 50vw" priority />
            ) : (
              <div className="flex h-full items-center justify-center text-store-navy/40">Sem imagem</div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{kit.nome}</h1>
            {kit.descricao ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-store-navy/80">{kit.descricao}</p>
            ) : null}

            <div className="space-y-1">
              {kit.economia > 0 ? (
                <p className="text-base text-store-navy/50 line-through tabular-nums">
                  {money.format(kit.precoNormal)}
                </p>
              ) : null}
              <p className="text-3xl font-bold tabular-nums">{money.format(kit.precoKit)}</p>
              {kit.economia > 0 ? (
                <p className="text-sm font-semibold text-emerald-800">
                  Economia de {money.format(kit.economia)}
                </p>
              ) : null}
            </div>

            <KitBuyButton kit={kit} />

            <div>
              <h2 className="text-lg font-bold">Itens inclusos</h2>
              <ul className="mt-3 divide-y divide-store-navy/10 rounded-sm border border-store-navy/10 bg-white">
                {kit.items.map((it) => (
                  <li key={it.product_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-store-cream">
                      {it.imageUrl ? (
                        <Image src={it.imageUrl} alt="" fill className="object-cover" sizes="56px" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/produtos/${it.product_id}`} className="font-semibold hover:underline">
                        {it.quantidade}x {it.titulo}
                      </Link>
                      <p className="text-xs text-store-navy/60">
                        {it.cod_produto} · {money.format(it.valor)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
