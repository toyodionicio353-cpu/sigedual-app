/** Estado vacío compartido por los listados principales de SIGEDUAL: cubre
 * tanto "sin registros" (con acción para agregar el primero) como "sin
 * resultados de búsqueda/filtro" (con acción para limpiar filtros). */
export default function EstadoVacio({
  icon, titulo, descripcion, accion,
}: {
  icon: React.ReactNode;
  titulo: string;
  descripcion: string;
  accion?: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
      <div style={{ background: "var(--accent)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">{titulo}</p>
      <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">{descripcion}</p>
      {accion}
    </div>
  );
}
