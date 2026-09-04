"use client";
import TituloPagina from "@/components/TituloPagina";
import DocumentoLegal from "./_components/DocumentoLegal";
import AceptacionTerminos from "./_components/AceptacionTerminos";
import { ScrollText } from "lucide-react";

export default function PoliticasPage() {
  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-6 print:hidden">
        <TituloPagina icon={<ScrollText size={28} />} className="mb-1">Términos, Condiciones y Política de Privacidad</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">
          Documento legal de SIGEDUAL sobre el tratamiento de datos personales y las condiciones de uso de la plataforma.
        </p>
      </div>

      <DocumentoLegal />

      <div className="mt-8 max-w-2xl print:hidden">
        <AceptacionTerminos />
      </div>
    </div>
  );
}
