"use client";
import { ScrollText, FileSignature } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

const DOCUMENTOS = [
  {
    id: "privacidad",
    icon: <ScrollText size={20} />,
    titulo: "Política de privacidad",
    descripcion: "Cómo SIGEDUAL trata la información de tu institución.",
  },
  {
    id: "terminos",
    icon: <FileSignature size={20} />,
    titulo: "Términos de uso",
    descripcion: "Condiciones de uso de la plataforma SIGEDUAL.",
  },
];

export default function PoliticasPage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <TituloPagina icon={<ScrollText size={28} />} className="mb-1">Políticas</TituloPagina>
      <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8">
        Política de privacidad y términos de uso de SIGEDUAL.
      </p>

      <div className="flex flex-col gap-4">
        {DOCUMENTOS.map((doc) => (
          <div key={doc.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: "var(--accent-light)" }}>{doc.icon}</span>
              <h2 style={{ color: "var(--text-primary)" }} className="text-base font-semibold">{doc.titulo}</h2>
            </div>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">{doc.descripcion}</p>
            <p style={{ color: "var(--text-muted)" }} className="text-sm">
              Esta sección todavía no tiene contenido. Estará disponible próximamente.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
