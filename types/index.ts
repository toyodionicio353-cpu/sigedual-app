export type Rol = "administrador" | "coordinador" | "director" | "profesor" | "centro_dual" | "estudiante";

export interface Usuario {
  uid: string;
  email: string;
  nombre: string;
  rol: Rol;
  especialidad?: string;
  run?: string;
  liceoId: string;
  activo: boolean;
  creadoEn: string;
  // Datos personales de "Mi perfil" — el propio usuario los administra.
  avatarUrl?: string;
  fechaNacimiento?: string;
  nacionalidad?: string;
  direccion?: string;
  numeroDireccion?: string;
  depto?: string;
  comuna?: string;
  ciudad?: string;
  region?: string;
  telefono?: string;
  telefonoSecundario?: string;
  descripcion?: string;
  actualizadoEn?: string;
  terminosAceptados?: AceptacionTerminos;
}

/** Registro de aceptación de los Términos, Condiciones y Política de
 * Privacidad — no incluye una "versión" del documento porque el texto
 * legal entregado todavía no declara una; no se inventa aquí. */
export interface AceptacionTerminos {
  aceptado: boolean;
  fecha: string;
}

export type TipoDatoSolicitud = "nombre" | "rut" | "correo" | "otro";

/** Solicitud de un usuario para modificar un dato bloqueado de su propio
 * perfil (ver Mi perfil). Queda pendiente de revisión administrativa —
 * SIGEDUAL todavía no tiene una bandeja de Administración que las liste. */
export interface SolicitudModificacion {
  id: string;
  uid: string;
  liceoId: string;
  tipoDato: TipoDatoSolicitud;
  valorActual: string;
  valorNuevo: string;
  motivo: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  creadoEn: string;
}

export interface Liceo {
  id: string;
  nombre: string;
  nombreCorto?: string;
  rut?: string;
  tipoEstablecimiento?: string;
  dependencia?: string;
  rbd: string;
  comuna: string;
  region: string;
  ciudad?: string;
  direccion: string;
  telefono?: string;
  email?: string;
  sitioWeb?: string;
  dominioCorreo?: string;
  responsableNombre?: string;
  responsableCargo?: string;
  responsableRun?: string;
  responsableTelefono?: string;
  responsableEmail?: string;
  estado?: "activo" | "inactivo";
  creadoEn?: string;
  actualizadoEn?: string;
  actualizadoPor?: string;
}

export interface CodigoAcceso {
  liceoId: string;
  codigo: string;
  generadoPor: string;
  expiraEn: string;
  actualizadoEn: string;
}

export interface Especialidad {
  id: string;
  nombre: string;
  liceoId: string;
  estado?: "activa" | "inactiva";
}

export interface Estudiante {
  id: string;
  run: string;
  nombres: string;
  apellidos: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string;
  sexo?: string;
  nacionalidad?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  anioAcademico?: string;
  curso: string;
  nivel: string;
  especialidadId: string;
  jornada?: string;
  liceoId: string;
  centroDualId?: string;
  profesorId?: string;
  estado: "activo" | "inactivo" | "egresado" | "retirado";
  fechaIncorporacionDual?: string;
  estadoDual?: string;
  enfermedadesCronicas?: string;
  alergias?: string;
  informacionMedicaAdicional?: string[];
  rasgos?: string[];
  habilidades?: string[];
  apoderadoNombre?: string;
  apoderadoRun?: string;
  apoderadoParentesco?: string;
  apoderadoTelefono?: string;
  apoderadoEmail?: string;
  apoderadoDomicilio?: string;
  apoderadoCiudad?: string;
  observaciones?: string;
  historialCursos?: HistorialCurso[];
  creadoEn: string;
  actualizadoEn?: string;
}

export interface HistorialCurso {
  anioAcademico: string;
  nivel: string;
  curso?: string;
  especialidadId: string;
  resultado: "aprobado" | "repitio";
  confirmadoEn: string;
  confirmadoPor: string;
}

export interface Conversacion {
  id: string;
  tipo: "privada" | "grupo";
  nombre?: string;
  participantes: string[];
  liceoId: string;
  ultimoMensaje?: string;
  ultimaActividad: string;
  creadoPor: string;
  creadoEn: string;
}

export interface MensajeConversacion {
  id: string;
  texto: string;
  uid: string;
  nombre: string;
  creadoEn: string;
}

export interface Soporte {
  liceoId: string;
  nombre: string;
  cargo: string;
  correo: string;
  telefono: string;
  direccion: string;
  horario: string;
  notas: string;
}

export type TipoCentroDual = "empresa" | "institucion" | "organizacion" | "otro";
export type EstadoCentroDual = "activo" | "inactivo" | "en_revision";

export interface CentroDual {
  id: string;
  nombre: string;
  rut?: string;
  tipo?: TipoCentroDual;
  razonSocial?: string;
  nombreComercial?: string;
  direccion: string;
  comuna: string;
  ciudad?: string;
  region?: string;
  telefono?: string;
  email?: string;
  sitioWeb?: string;
  contactoNombre?: string;
  contactoCargo?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  /** @deprecated se gestiona desde "Centros Duales → Lista de maestro guía"; se conserva por compatibilidad con centros creados antes de ese cambio */
  maestroGuia?: string;
  /** @deprecated ver maestroGuia */
  telefonoMaestro?: string;
  /** @deprecated ver maestroGuia */
  emailMaestro?: string;
  liceoId: string;
  especialidades: string[];
  areasDesempeno?: string[];
  caracteristicas?: string[];
  habilidadesValoradas?: string[];
  /** dato ingresado por el administrador; los cupos disponibles se calculan, no se guardan */
  capacidad?: number;
  /** @deprecated usar capacidad */
  cuposDisponibles?: number;
  estado?: EstadoCentroDual;
  /** @deprecated usar estado; se mantiene espejado en escritura por compatibilidad con código que aún lo lea */
  activo: boolean;
  creadoEn?: string;
}

export type EstadoAsignacion =
  | "pendiente"
  | "en_proceso"
  | "asignada"
  | "activa"
  | "finalizada"
  | "cancelada";

export interface FactorCompatibilidad {
  tipo: "especialidad" | "caracteristica" | "habilidad" | "advertencia";
  descripcion: string;
}

export interface Compatibilidad {
  puntaje: number | null;
  limitada: boolean;
  coincidencias: FactorCompatibilidad[];
  advertencias: FactorCompatibilidad[];
}

export interface Asignacion {
  id: string;
  estudianteId: string;
  centroDualId: string;
  liceoId: string;
  estado: EstadoAsignacion;
  fechaInicio?: string;
  fechaTermino?: string;
  jornada?: string;
  profesorSupervisorId?: string;
  maestroGuia?: string;
  maestroGuiaId?: string;
  observaciones?: string;
  compatibilidad: Compatibilidad;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn?: string;
}

export type EstadoMaestroGuia = "activo" | "inactivo";

export interface MaestroGuia {
  id: string;
  centroDualId: string;
  liceoId: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  run: string;
  email: string;
  telefono: string;
  cargo: string;
  area?: string;
  aniosExperiencia?: number;
  especialidades: string[];
  areasSupervision?: string[];
  capacidad?: number;
  estado: EstadoMaestroGuia;
  observaciones?: string;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn?: string;
}

export type TipoModuloDocumento = "convenio" | "evaluacion" | "documento";
export type TipoSegmentoPlantilla = "protegido" | "editable" | "campo";

export interface SegmentoDocumento {
  tipo: TipoSegmentoPlantilla;
  texto: string;
  clave?: string;
}

export interface DocumentoGenerado {
  id: string;
  tipoModulo: TipoModuloDocumento;
  plantillaId: string;
  liceoId: string;
  nombre: string;
  estudianteId?: string;
  campos: Record<string, string>;
  contenido: SegmentoDocumento[][];
  creadoPor: string;
  creadoEn: string;
  actualizadoEn?: string;
}
