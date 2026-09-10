import type {
  Asignacion, CentroDual, EstadoAsignacion, PracticaProfesional,
} from "@/types";

/**
 * Estado visual de un pin del Mapa Dual.
 *
 * Nada de esto se guarda en Firestore: se DERIVA de los datos reales cada
 * vez que se dibuja el mapa. Un color guardado a mano quedaría mentiroso
 * en cuanto alguien asigna un estudiante o pasa una fecha, que es
 * exactamente lo que el mapa debe reflejar sin intervención.
 */

/** Días que dura el período de prueba de un Centro Dual nuevo. */
export const DIAS_PERIODO_PRUEBA = 60;

/** Con cuánta anticipación una asignación o práctica se considera
 * "próxima a finalizar". */
export const DIAS_PARA_AVISO_TERMINO = 30;

export type EstadoPinCentro =
  /** Activo y sin estudiantes asignados. */
  | "disponible"
  /** Activo con estudiantes asignados y capacidad completa. */
  | "asignado"
  /** Requiere atención: cupos parcialmente ocupados, asignación por
   * terminar, o el propio centro marcado en revisión. */
  | "atencion"
  /** Centro dado de baja. */
  | "inactivo"
  /** Situación crítica: el centro está inactivo pero todavía tiene
   * estudiantes asignados en curso — nadie debería quedar ahí. */
  | "critico";

export type EstadoPinPractica = "activa" | "por_finalizar" | "finalizada" | "atencion";

/** Asignaciones que ocupan un cupo real del Centro Dual. Una pendiente o
 * finalizada no ocupa: contarlas inflaría la ocupación y pintaría de azul
 * un centro que en realidad tiene sitio. */
const ESTADOS_QUE_OCUPAN_CUPO: EstadoAsignacion[] = ["en_proceso", "asignada"];

export function ocupaCupo(a: Asignacion): boolean {
  return ESTADOS_QUE_OCUPAN_CUPO.includes(a.estado);
}

function diasEntre(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / 86_400_000);
}

function fecha(valor?: string): Date | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * ¿El Centro Dual está dentro de sus primeros 60 días? Se calcula contra
 * `creadoEn`, no contra una bandera guardada, así el anillo morado
 * desaparece solo al día 60 sin que nadie tenga que apagarlo.
 *
 * Un centro sin `creadoEn` (creado antes de que ese campo existiera) no es
 * nuevo: si lo tratáramos como nuevo, los registros más antiguos del
 * sistema serían justamente los que aparecerían "recién creados".
 */
export function esCentroNuevo(centro: CentroDual, ahora = new Date()): boolean {
  const creado = fecha(centro.creadoEn);
  if (!creado) return false;
  const dias = diasEntre(creado, ahora);
  return dias >= 0 && dias < DIAS_PERIODO_PRUEBA;
}

export interface CapacidadCentro {
  /** Capacidad declarada en la ficha. `null` si nunca se registró: no es
   * lo mismo que capacidad 0, y no se asume ningún número. */
  total: number | null;
  ocupados: number;
  /** null cuando no hay capacidad declarada — no se puede calcular. */
  disponibles: number | null;
  /** Texto ya resuelto para la ficha ("Falta 1 estudiante"). */
  descripcion: string;
}

export function calcularCapacidad(centro: CentroDual, asignaciones: Asignacion[]): CapacidadCentro {
  const ocupados = asignaciones.filter(ocupaCupo).length;
  const total = typeof centro.capacidad === "number" && centro.capacidad >= 0 ? centro.capacidad : null;

  if (total === null) {
    return {
      total: null,
      ocupados,
      disponibles: null,
      descripcion: ocupados === 1 ? "1 estudiante asignado · capacidad sin registrar" : `${ocupados} estudiantes asignados · capacidad sin registrar`,
    };
  }

  const disponibles = Math.max(0, total - ocupados);
  let descripcion: string;
  if (disponibles === 0) descripcion = "Capacidad completa";
  else if (disponibles === 1) descripcion = "Falta 1 estudiante";
  else descripcion = `Faltan ${disponibles} estudiantes`;

  return { total, ocupados, disponibles, descripcion };
}

/** ¿Alguna asignación vigente termina dentro de la ventana de aviso? */
function hayTerminoProximo(asignaciones: Asignacion[], ahora: Date): boolean {
  return asignaciones.some((a) => {
    if (!ocupaCupo(a)) return false;
    const termino = fecha(a.fechaTermino);
    if (!termino) return false;
    const dias = diasEntre(ahora, termino);
    return dias >= 0 && dias <= DIAS_PARA_AVISO_TERMINO;
  });
}

/**
 * Color del pin de un Centro Dual.
 *
 * "Activo" y "asignado" son ejes independientes a propósito (punto 16 del
 * requerimiento): un centro puede estar activo y vacío, activo y lleno, o
 * inactivo con gente dentro — este último es el caso crítico.
 */
export function estadoDeCentro(
  centro: CentroDual,
  asignaciones: Asignacion[],
  ahora = new Date()
): EstadoPinCentro {
  const activo = centro.estado ? centro.estado === "activo" : centro.activo !== false;
  const capacidad = calcularCapacidad(centro, asignaciones);

  if (!activo) {
    // Inactivo pero con estudiantes todavía dentro: nadie debería quedar
    // en un centro dado de baja. Eso es lo crítico, no la baja en sí.
    return capacidad.ocupados > 0 ? "critico" : "inactivo";
  }

  if (centro.estado === "en_revision") return "atencion";
  if (hayTerminoProximo(asignaciones, ahora)) return "atencion";

  if (capacidad.ocupados === 0) return "disponible";
  // Capacidad parcialmente ocupada = todavía queda sitio por llenar.
  if (capacidad.disponibles !== null && capacidad.disponibles > 0) return "atencion";
  return "asignado";
}

/** Color/indicador del pin de una Práctica Profesional. Todas son rosadas;
 * esto solo decide el matiz e indicador dentro de ese color. */
export function estadoDePractica(
  practica: PracticaProfesional,
  ahora = new Date()
): EstadoPinPractica {
  if (practica.estado === "requiere_atencion") return "atencion";
  if (practica.estado === "finalizada") return "finalizada";

  const termino = fecha(practica.fechaTermino);
  if (termino) {
    const dias = diasEntre(ahora, termino);
    // Ya pasó la fecha de término pero nadie la cerró: eso necesita
    // revisión humana, no se cierra sola a espaldas de quien la gestiona.
    if (dias < 0) return "atencion";
    if (dias <= DIAS_PARA_AVISO_TERMINO) return "por_finalizar";
  }
  return "activa";
}

/** Colores de cada estado. Un solo lugar para que pin, ficha y leyenda no
 * se contradigan nunca. El rosado queda reservado a las prácticas. */
export const COLOR_CENTRO: Record<EstadoPinCentro, string> = {
  disponible: "#16A34A",
  asignado: "#2563EB",
  atencion: "#EAB308",
  inactivo: "#DC2626",
  critico: "#111111",
};

export const COLOR_PRACTICA = "#DB2777";
/** Anillo del período de prueba — se suma al color principal, no lo reemplaza. */
export const COLOR_ANILLO_NUEVO = "#9333EA";

export const ETIQUETA_CENTRO: Record<EstadoPinCentro, string> = {
  disponible: "Activo sin asignación",
  asignado: "Activo con asignación",
  atencion: "Requiere atención",
  inactivo: "Inactivo",
  critico: "Situación crítica",
};

export const ETIQUETA_PRACTICA: Record<EstadoPinPractica, string> = {
  activa: "Activa",
  por_finalizar: "Próxima a finalizar",
  finalizada: "Finalizada",
  atencion: "Requiere atención",
};
