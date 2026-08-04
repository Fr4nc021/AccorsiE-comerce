import { createDraftKit } from "@/features/kits/services/createDraftKit";

export const metadata = { title: "Novo kit | Admin" };

export default async function NovoKitPage() {
  await createDraftKit();
  return null;
}
