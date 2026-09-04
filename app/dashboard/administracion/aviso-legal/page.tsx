"use client";
import { Scale } from "lucide-react";
import PaginaVacia from "@/components/PaginaVacia";

export default function AvisoLegalPage() {
  return (
    <PaginaVacia
      icon={<Scale size={28} />}
      titulo="Aviso legal"
      descripcion="Información legal sobre SIGEDUAL y su titularidad."
    />
  );
}
