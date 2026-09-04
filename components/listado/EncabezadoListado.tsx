import TituloPagina from "@/components/TituloPagina";

/** Encabezado común de los listados principales de SIGEDUAL: título con
 * ícono, descripción breve y un slot para las acciones (botón principal
 * "+ Agregar..." y, opcionalmente, acciones secundarias como "Promoción
 * de curso"). */
export default function EncabezadoListado({
  icon, titulo, descripcion, acciones,
}: {
  icon: React.ReactNode;
  titulo: string;
  descripcion: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        <TituloPagina icon={icon}>{titulo}</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{descripcion}</p>
      </div>
      {acciones && <div className="flex items-center gap-2 flex-shrink-0">{acciones}</div>}
    </div>
  );
}
