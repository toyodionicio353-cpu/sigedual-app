/** Tope de publicaciones por liceo y semestre. */
export const MAX_POR_SEMESTRE = 20;
/** Cuánto puede permanecer publicada una novedad, como máximo. */
export const MESES_MAX_PUBLICACION = 2;

export interface Periodo {
  anio: number;
  semestre: 1 | 2;
}

/**
 * Semestre calendario de una fecha.
 *   1er semestre: 1 de enero → 30 de junio.
 *   2do semestre: 1 de julio → 31 de diciembre.
 *
 * El cupo se reinicia solo al cambiar de semestre porque el contador vive
 * en un documento distinto por período; nadie tiene que ponerlo a cero.
 */
export function periodoDe(fecha: Date = new Date()): Periodo {
  return { anio: fecha.getFullYear(), semestre: fecha.getMonth() < 6 ? 1 : 2 };
}

/** Id del documento de cupo. Determinista, para poder leerlo y escribirlo
 * por ruta conocida sin consultar nada. */
export function idCupo(liceoId: string, periodo: Periodo): string {
  return `${liceoId}_${periodo.anio}_S${periodo.semestre}`;
}

/**
 * Última fecha de expiración admisible: dos meses exactos desde la
 * publicación. `setMonth` ajusta solo los desbordes de mes (31 de
 * diciembre + 2 meses cae en el último día de febrero, no en marzo).
 */
export function expiracionMaxima(desde: Date = new Date()): Date {
  const limite = new Date(desde);
  const diaOriginal = limite.getDate();
  limite.setMonth(limite.getMonth() + MESES_MAX_PUBLICACION);
  if (limite.getDate() < diaOriginal) limite.setDate(0);
  return limite;
}

/**
 * Editor independiente: SIGEDUAL publicando en su propio nombre, no como
 * uno de los liceos. Es quien mantiene la plataforma, así que sus avisos
 * (novedades del sistema, anuncios generales) no compiten por el cupo de
 * ningún establecimiento ni caducan al ritmo de una convocatoria escolar.
 */
export const LICEO_SIGEDUAL = "sigedual";
export const NOMBRE_SIGEDUAL = "SIGEDUAL";

/** ¿Este rol publica por su cuenta, fuera del cupo de los liceos? */
export function esEditorIndependiente(rol: string | undefined): boolean {
  return rol === "desarrollador";
}

/** Opciones de duración ofrecidas al publicar. Dos meses es el máximo y
 * también lo que viene elegido por defecto. */
export const DURACIONES_DIAS = [7, 15, 30, 45, 60] as const;

/** Duraciones del editor independiente: las mismas, más plazos largos
 * para avisos que no dependen de una convocatoria. */
export const DURACIONES_DIAS_INDEPENDIENTE = [7, 15, 30, 45, 60, 90, 180, 365] as const;

/** Tope de permanencia del editor independiente: un año. Sigue habiendo
 * un tope — una publicación sin vencimiento se queda ahí para siempre y
 * nadie se acuerda de retirarla. */
export const DIAS_MAX_INDEPENDIENTE = 365;

/** Fecha de término a partir de una duración en días, sin pasarse del
 * tope que corresponda a quien publica. */
export function expiracionDesdeDias(dias: number, desde: Date = new Date(), independiente = false): Date {
  const fin = new Date(desde);
  fin.setDate(fin.getDate() + dias);
  const tope = independiente ? topeIndependiente(desde) : expiracionMaxima(desde);
  return fin > tope ? tope : fin;
}

/** Último término admisible para el editor independiente. */
export function topeIndependiente(desde: Date = new Date()): Date {
  const limite = new Date(desde);
  limite.setDate(limite.getDate() + DIAS_MAX_INDEPENDIENTE);
  return limite;
}

/** ¿Sigue vigente? Una novedad sin fecha de término no se considera
 * vigente: publicar sin expiración es justo lo que no se permite. */
export function estaVigente(expiraEn: string | undefined, ahora: Date = new Date()): boolean {
  if (!expiraEn) return false;
  const fin = new Date(expiraEn);
  if (Number.isNaN(fin.getTime())) return false;
  return fin.getTime() > ahora.getTime();
}
