import TituloPagina from "@/components/TituloPagina";

export default function PaginaVacia({
  icon, titulo, descripcion, mensaje,
}: { icon: React.ReactNode; titulo: string; descripcion?: string; mensaje?: string }) {
  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <TituloPagina icon={icon} className="mb-1">{titulo}</TituloPagina>
      {descripcion && (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-8">{descripcion}</p>
      )}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          {mensaje ?? "Esta sección todavía no tiene contenido. Estará disponible próximamente."}
        </p>
      </div>
    </div>
  );
}
