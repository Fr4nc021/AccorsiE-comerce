import { createDraftProduct, duplicateProductAsDraft } from "@/features/produtos/services/createDraftProduct";

export const metadata = {
  title: "Novo produto | Admin",
};

export default async function NovoProdutoPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicar?: string | string[] }>;
}) {
  const sp = await searchParams;
  const duplicarId =
    typeof sp.duplicar === "string" ? sp.duplicar : Array.isArray(sp.duplicar) ? sp.duplicar[0] : "";

  if (duplicarId) {
    await duplicateProductAsDraft(duplicarId);
  } else {
    await createDraftProduct();
  }

  // redirect() inside the actions never returns; keep a fallback UI for typecheck.
  return null;
}
