import type {
  Asignacion, CentroDual, Especialidad, Estudiante, Liceo, MaestroGuia,
  SegmentoDocumento, TipoModuloDocumento, Usuario,
} from "@/types";

export interface ContextoResolucion {
  estudiantes: Estudiante[];
  asignaciones: Asignacion[];
  centros: CentroDual[];
  maestrosGuia: MaestroGuia[];
  profesores: Usuario[];
  especialidades: Especialidad[];
  liceo?: Liceo;
}

export interface PlantillaDocumento {
  id: string;
  tipoModulo: TipoModuloDocumento;
  /** Nombre de la plantilla — nunca se guarda como nombre final del documento. */
  nombre: string;
  descripcion?: string;
  /** Fragmento corto para la tarjeta compacta de la pestaña Plantillas. */
  previewLineas: string[];
  parrafos: SegmentoDocumento[][];
  /** Claves de segmentos "campo" que deben resolver para poder guardar. */
  camposRequeridos: string[];
  requiereEstudiante: boolean;
  /** Regla de elegibilidad del estudiante para esta plantilla puntual. Si se omite, todos son elegibles. */
  elegibilidad?: (ctx: ContextoResolucion, estudiante: Estudiante) => boolean;
  /** Alcance de la validación de nombre único. Por defecto "modulo". */
  alcanceUnicidadNombre?: "modulo" | "liceo";
}
