/** Texto de contador de resultados compartido por los listados
 * principales de SIGEDUAL. Si se pasa un rango de paginación, muestra
 * "Mostrando X–Y de Z"; si no, muestra "Z encontrado(s)". */
export default function ContadorResultados({
  total, entidadSingular, entidadPlural, rango,
}: {
  total: number;
  entidadSingular: string;
  entidadPlural: string;
  rango?: { inicio: number; fin: number };
}) {
  const etiqueta = total === 1 ? entidadSingular : entidadPlural;
  return (
    <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">
      {rango
        ? `Mostrando ${rango.inicio}–${rango.fin} de ${total} ${etiqueta}`
        : `${total} ${etiqueta} encontrado(s)`}
    </p>
  );
}
