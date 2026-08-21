import type { Metadata } from "next";

import { ConsultaFipeClient } from "@/features/fipe-consulta/components/ConsultaFipeClient";

export const metadata: Metadata = {
  title: "Consulta FIPE | Admin",
  description: "Lista marcas, modelos e anos da tabela FIPE e importa para o catálogo.",
};

export default function ConsultaFipePage() {
  return (
    <div className="mx-auto w-full max-w-store">
      <ConsultaFipeClient />
    </div>
  );
}
