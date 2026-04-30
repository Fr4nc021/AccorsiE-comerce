import type { Metadata } from "next";

import { ConsultaFipeClient } from "@/features/fipe-consulta/components/ConsultaFipeClient";

export const metadata: Metadata = {
  title: "Consulta FIPE | Admin",
  description: "Lista marcas e modelos da tabela FIPE via API (integração admin).",
};

export default function ConsultaFipePage() {
  return (
    <div className="mx-auto w-full max-w-store">
      <ConsultaFipeClient />
    </div>
  );
}
