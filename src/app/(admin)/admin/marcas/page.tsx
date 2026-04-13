import { redirect } from "next/navigation";

export default async function MarcasLegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ cadastrado?: string }>;
}) {
  const { cadastrado } = await searchParams;
  if (cadastrado === "1") {
    redirect("/admin/marcas-e-modelos?cadastrado=marca");
  }
  redirect("/admin/marcas-e-modelos");
}
