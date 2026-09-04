"use client";
import { FileSignature } from "lucide-react";
import PaginaVacia from "@/components/PaginaVacia";

export default function TerminosPage() {
  return (
    <PaginaVacia
      icon={<FileSignature size={28} />}
      titulo="Términos y condiciones"
      descripcion="Condiciones de uso de la plataforma SIGEDUAL."
    />
  );
}
