"use client";
import { User } from "lucide-react";
import PaginaVacia from "@/components/PaginaVacia";

export default function UsuarioPage() {
  return (
    <PaginaVacia
      icon={<User size={28} />}
      titulo="Usuario"
      descripcion="Información y preferencias de tu cuenta en SIGEDUAL."
    />
  );
}
