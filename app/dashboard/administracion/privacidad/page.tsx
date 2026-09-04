"use client";
import { ScrollText } from "lucide-react";
import PaginaVacia from "@/components/PaginaVacia";

export default function PoliticasPrivacidadPage() {
  return (
    <PaginaVacia
      icon={<ScrollText size={28} />}
      titulo="Políticas de privacidad"
      descripcion="Cómo SIGEDUAL trata la información de tu institución."
    />
  );
}
