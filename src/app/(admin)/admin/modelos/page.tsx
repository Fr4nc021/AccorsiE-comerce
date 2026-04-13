import { redirect } from "next/navigation";

export default async function ModelosLegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ cadastrado?: string }>;
}) {
  const { cadastrado } = await searchParams;
  if (cadastrado === "1") {
    redirect("/admin/marcas-e-modelos?cadastrado=modelo");
  }
  redirect("/admin/marcas-e-modelos");
}
