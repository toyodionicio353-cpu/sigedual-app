/**
 * "YYYY-MM-DD" (lo que entrega <input type="date">) se interpreta por
 * defecto como medianoche UTC — en la zona horaria de Chile eso corre la
 * fecha un día hacia atrás al mostrarla (ej. "22 de mayo" aparece como "21
 * de mayo"). Se arma la fecha con sus componentes locales para evitarlo.
 */
export function parsearFecha(iso: string): Date {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (soloFecha) {
    const [, anio, mes, dia] = soloFecha;
    return new Date(Number(anio), Number(mes) - 1, Number(dia));
  }
  return new Date(iso);
}

/** Formatea una fecha (ISO completo o solo "YYYY-MM-DD") como "22 de mayo de 2008". */
export function formatearFecha(iso?: string): string {
  if (!iso) return "";
  const fecha = parsearFecha(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}
