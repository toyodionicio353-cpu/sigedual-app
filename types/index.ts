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
  // Solo poblados cuando rol === "centro_dual": vinculan esta cuenta de
  // acceso al Maestro Guía/Centro Dual que representa (ver "Crear acceso"
  // en la ficha de Maestro Guía). centroDualId se denormaliza desde
  // MaestroGuia.centroDualId para que las reglas de Firestore no necesiten
  // un get() adicional.
  maestroGuiaId?: string;
  centroDualId?: string;
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
  creadoEn?: string;
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
  /** uid de quien creó el registro. Poblado desde esta fecha en adelante;
   * los centros creados antes no lo tienen. */
  creadoPor?: string;
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

export type TipoModuloDocumento = "convenio" | "documento";
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

// "programada" y "realizada" son valores legado (visitas creadas antes de
// esta ampliación) — se siguen leyendo/mostrando, pero nunca se escriben
// en visitas nuevas. Ver lib/visitas/normalizar.ts para el mapeo a los
// estados nuevos al mostrarlas.
export type EstadoVisita =
  | "agendada" | "en_proceso" | "pendiente_de_finalizar"
  | "finalizada" | "cancelada" | "reprogramada"
  | "programada" | "realizada";

export type FuenteInformacionVisita = "maestro_guia" | "personal_oficina" | "encargado_empresa" | "otro";

/** Respuesta a una pregunta base — el texto de la pregunta se copia
 * (snapshot) al iniciar la visita, para que una visita ya iniciada nunca
 * cambie de contenido aunque la plantilla de preguntas se edite después. */
export interface RespuestaPreguntaVisita {
  id: string;
  categoria: string;
  texto: string;
  respuesta: string;
  fuente?: FuenteInformacionVisita;
  fuenteNombre?: string;
  fuenteCargo?: string;
}

export type TipoElementoPersonalizado = "pregunta" | "observacion" | "acuerdo" | "situacion" | "otro";

export interface ElementoPersonalizadoVisita {
  id: string;
  tipo: TipoElementoPersonalizado;
  titulo?: string;
  contenido: string;
  fuente?: FuenteInformacionVisita;
  fuenteNombre?: string;
  fuenteCargo?: string;
}

export interface AcuerdoVisita {
  id: string;
  situacion: string;
  accion: string;
  responsable: string;
  fechaComprometida?: string;
  observaciones?: string;
  /** Preparado para integrarse después con notificaciones/calendario. */
  fechaSeguimiento?: string;
}

export interface Visita {
  id: string;
  liceoId: string;
  centroDualId: string;
  /** Uno o varios estudiantes correspondientes a esta visita. */
  estudianteIds: string[];
  maestroGuiaId?: string;
  /** Responsable formal del registro — reemplaza a "profesorId". */
  profesorSupervisorId: string;
  direccion?: string;
  motivo?: string;
  observacionesPrevias?: string;
  fechaProgramada: string;
  horaProgramada?: string;
  fechaReal?: string;
  horaInicioReal?: string;
  horaTerminoReal?: string;
  estado: EstadoVisita;
  preguntas: RespuestaPreguntaVisita[];
  elementosPersonalizados: ElementoPersonalizadoVisita[];
  observacionesGenerales?: string;
  acuerdos: AcuerdoVisita[];
  creadoPor: string;
  creadoEn: string;
  iniciadoPor?: string;
  iniciadoEn?: string;
  finalizadoPor?: string;
  finalizadoEn?: string;
  actualizadoEn?: string;
  // Campos legado — solo presentes en visitas creadas antes de esta ampliación.
  estudianteId?: string;
  profesorId?: string;
  fecha?: string;
  hora?: string;
  observaciones?: string;
}

export type EstadoTicket =
  | "nuevo"
  | "abierto"
  | "en_revision"
  | "en_proceso"
  | "esperando_respuesta"
  | "resuelto"
  | "cerrado";

export type PrioridadTicket = "baja" | "media" | "alta" | "critica";

export type TipoTicket =
  | "problema"
  | "error"
  | "solicitud"
  | "incidencia"
  | "soporte_tecnico"
  | "datos"
  | "otro";

export interface Ticket {
  id: string;
  numero: number;
  asunto: string;
  descripcion: string;
  tipo: TipoTicket;
  prioridad: PrioridadTicket;
  estado: EstadoTicket;
  creadoPor: string;
  creadoPorNombre: string;
  liceoId: string;
  asignadoA?: string;
  asignadoANombre?: string;
  creadoEn: string;
  actualizadoEn?: string;
  resueltoEn?: string;
  cerradoEn?: string;
}

export interface MensajeTicket {
  id: string;
  texto: string;
  uid: string;
  nombre: string;
  creadoEn: string;
}

export interface NotaInternaTicket {
  id: string;
  texto: string;
  uid: string;
  nombre: string;
  creadoEn: string;
}

export type TipoNotificacion =
  | "alerta"
  | "aviso"
  | "mensaje"
  | "solicitud"
  | "cambio"
  | "evaluacion_pendiente"
  | "visita_proxima"
  | "documento_pendiente"
  | "firma_pendiente"
  | "asignacion"
  | "actualizacion_sistema"
  | "incidencia"
  | "recordatorio"
  | "ticket"
  | "formulario_recibido";

export interface Notificacion {
  id: string;
  destinatarioUid: string;
  liceoId: string;
  tipo: TipoNotificacion;
  titulo: string;
  descripcion: string;
  prioridad?: "baja" | "media" | "alta";
  leida: boolean;
  accionHref?: string;
  accionLabel?: string;
  creadoEn: string;
  leidaEn?: string;
}

// ── Invitación a Empresa Dual (levantamiento de datos externo) ────────────

export type EstadoInvitacion =
  | "generado"
  | "abierto"
  | "enviado"
  | "en_revision"
  | "procesado"
  | "expirado"
  | "revocado";

export interface InvitacionEmpresa {
  id: string;
  liceoId: string;
  profesorUid: string;
  profesorNombre: string;
  especialidadId?: string;
  cursos?: string[];
  nombrePreliminar?: string;
  contactoNombre?: string;
  contactoEmail?: string;
  contactoTelefono?: string;
  observaciones?: string;
  estado: EstadoInvitacion;
  creadoEn: string;
  expiraEn?: string;
  ultimoAccesoEn?: string;
  enviadoEn?: string;
  procesadoEn?: string;
  centroDualIdResultado?: string;
}

/** Nivel de detalle estructurado de las "necesidades" que la empresa
 * declara sobre los estudiantes que puede recibir — se guarda tal cual la
 * entrega la empresa, todavía no se usa en lib/compatibilidad.ts. */
export interface NecesidadesEmpresa {
  nivelActividad?: "muy_activo" | "moderado" | "tranquilo" | "no_determinante";
  ritmoAprendizaje?: "rapido" | "moderado" | "acompanado";
  autonomia?: "alta" | "media" | "supervision_constante";
  adaptacion?: "alta" | "media" | "baja";
  comunicacion?: "alta_clientes" | "moderada" | "interna";
  trabajoEquipo?: "alto" | "medio" | "bajo";
  otras?: string;
}

export interface RespuestaMaestroGuiaInvitacion {
  id: string;
  nombres: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  run?: string;
  cargo?: string;
  area?: string;
  email?: string;
  telefono?: string;
  aniosExperiencia?: string;
  capacidad?: string;
  especialidad?: string;
  disponibilidad?: string;
  observaciones?: string;
}

export interface RespuestaInvitacion {
  id: string;
  invitacionId: string;
  liceoId: string;
  empresa: {
    razonSocial?: string;
    nombreFantasia?: string;
    rut?: string;
    tipo?: TipoCentroDual;
    giro?: string;
    direccion?: string;
    comuna?: string;
    ciudad?: string;
    region?: string;
    telefono?: string;
    email?: string;
    sitioWeb?: string;
    contactoNombre?: string;
    contactoCargo?: string;
    contactoEmail?: string;
    contactoTelefono?: string;
  };
  perfil: {
    actividadPrincipal?: string;
    areaTrabajo?: string;
    tipoTareas?: string;
    tecnologias?: string;
    herramientas?: string;
    ambienteLaboral?: string;
    caracteristicasImportantes?: string;
  };
  necesidades: NecesidadesEmpresa;
  /** Mismo vocabulario que usa el formulario oficial de Empresa Dual
   * (lib/caracteristicas.ts) — al usar los mismos catálogos, la selección
   * de la empresa se puede prellenar 1:1 en CentroDualForm sin adivinar. */
  caracteristicas: {
    ambiente?: string[];
    habilidadesValoradas?: string[];
    areasDesempeno?: string[];
  };
  capacidad: {
    cantidadEstudiantes?: number;
    especialidades?: string[];
    cursos?: string[];
    periodo?: string;
    jornada?: string;
    horarios?: string;
    restricciones?: string;
  };
  maestrosGuia: RespuestaMaestroGuiaInvitacion[];
  creadoEn: string;
  enviadoEn: string;
}

/** Índice inverso RUT → CentroDual (documentos de centros_duales usan ID
 * autogenerado, no el RUT) — permite detectar duplicados sin necesitar una
 * consulta amplia que las reglas de Firestore no permitirían a un profesor
 * fuera de su ámbito. Mismo patrón que `autorizaciones`. */
export interface IndiceCentroDualPorRut {
  centroDualId: string;
  liceoId: string;
}

// ── Invitación a Estudiante (mismo patrón que InvitacionEmpresa, pero
// colecciones y flujo propios — ver lib/estudiantes/indiceRun.ts y
// app/api/invitaciones-estudiante/) ────────────────────────────────────

export interface InvitacionEstudiante {
  id: string;
  liceoId: string;
  profesorUid: string;
  profesorNombre: string;
  nombrePreliminar?: string;
  estado: EstadoInvitacion;
  creadoEn: string;
  expiraEn?: string;
  ultimoAccesoEn?: string;
  enviadoEn?: string;
  procesadoEn?: string;
  estudianteIdResultado?: string;
}

export interface RespuestaInvitacionEstudiante {
  id: string;
  invitacionId: string;
  liceoId: string;
  run: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  sexo: string;
  nacionalidad: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  anioAcademico: string;
  nivel: string;
  curso: string;
  especialidadId: string;
  jornada: string;
  enfermedadesCronicas: string;
  alergias: string;
  informacionMedicaAdicional: string[];
  rasgos: string[];
  habilidades: string[];
  apoderadoNombre: string;
  apoderadoRun: string;
  apoderadoParentesco: string;
  apoderadoTelefono: string;
  apoderadoEmail: string;
  apoderadoDomicilio: string;
  apoderadoCiudad: string;
  observaciones: string;
  creadoEn: string;
  enviadoEn: string;
}

/** Índice inverso RUN → Estudiante, mismo patrón que IndiceCentroDualPorRut
 * — usado por el flujo de invitación a estudiante para detectar duplicados. */
export interface IndiceEstudiantePorRun {
  estudianteId: string;
  liceoId: string;
}

// ── Formularios masivos (campañas): un mismo enlace recibe muchas
// respuestas independientes hasta un cupo, a diferencia de las
// invitaciones individuales de arriba (un enlace = una respuesta, se
// inutiliza al enviarse). Colecciones y tipos propios, en paralelo —
// ver app/api/campanias(-estudiante)/. ──────────────────────────────────

export type EstadoCampania = "activa" | "completa" | "expirada" | "revocada";

export type EstadoRespuestaCampania =
  | "recibido"
  | "revision"
  | "aprobado"
  | "rechazado"
  | "traspasado"
  | "error"
  | "duplicado";

export interface CampaniaInvitacionEstudiante {
  id: string;
  liceoId: string;
  profesorUid: string;
  profesorNombre: string;
  nombre: string;
  capacidad: number;
  respuestasCount: number;
  estado: EstadoCampania;
  creadoEn: string;
  expiraEn?: string;
  ultimoAccesoEn?: string;
}

export interface RespuestaCampaniaEstudiante {
  id: string;
  campaniaId: string;
  liceoId: string;
  numero: number;
  estado: EstadoRespuestaCampania;
  run: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  sexo: string;
  nacionalidad: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  anioAcademico: string;
  nivel: string;
  curso: string;
  especialidadId: string;
  jornada: string;
  enfermedadesCronicas: string;
  alergias: string;
  informacionMedicaAdicional: string[];
  rasgos: string[];
  habilidades: string[];
  apoderadoNombre: string;
  apoderadoRun: string;
  apoderadoParentesco: string;
  apoderadoTelefono: string;
  apoderadoEmail: string;
  apoderadoDomicilio: string;
  apoderadoCiudad: string;
  observaciones: string;
  creadoEn: string;
  enviadoEn: string;
  procesadoEn?: string;
  estudianteIdResultado?: string;
  errorDetalle?: string;
}

export interface CampaniaInvitacionEmpresa {
  id: string;
  liceoId: string;
  profesorUid: string;
  profesorNombre: string;
  nombre: string;
  capacidad: number;
  respuestasCount: number;
  estado: EstadoCampania;
  creadoEn: string;
  expiraEn?: string;
  ultimoAccesoEn?: string;
}

export interface RespuestaCampaniaEmpresa {
  id: string;
  campaniaId: string;
  liceoId: string;
  numero: number;
  estado: EstadoRespuestaCampania;
  empresa: RespuestaInvitacion["empresa"];
  perfil: RespuestaInvitacion["perfil"];
  necesidades: NecesidadesEmpresa;
  caracteristicas: RespuestaInvitacion["caracteristicas"];
  capacidad: RespuestaInvitacion["capacidad"];
  maestrosGuia: RespuestaMaestroGuiaInvitacion[];
  creadoEn: string;
  enviadoEn: string;
  procesadoEn?: string;
  centroDualIdResultado?: string;
  errorDetalle?: string;
}

// ── Evaluaciones (desempeño del estudiante en su Centro Dual) ──────────

/** Escala de logro de la pauta: I (Insuficiente), R (Regular), B (Bueno),
 * MB (Muy Bueno). Definida acá (no en lib/evaluaciones) porque types/
 * nunca importa de lib/ — lib/evaluaciones/tipos.ts reexporta este tipo. */
export type NivelLogro = "I" | "R" | "B" | "MB";

// "autoevaluacion" y otros tipos futuros (sección 17 del pedido original)
// se agregan acá cuando se implementen — el resto del modelo ya los admite.
export type TipoEvaluador = "maestro_guia";

export interface TareaAdicionalEvaluacion {
  descripcion: string;
  valor: NivelLogro;
  observacion?: string;
}

/**
 * Registro permanente de una evaluación ya completada — un documento por
 * evaluación, nunca se sobrescribe (ver "estado": siempre "completada",
 * no hay borrador/guardado parcial). Cada criterio se guarda
 * individualmente (no solo el promedio) para habilitar reportes e
 * historial más adelante.
 */
export interface Evaluacion {
  id: string;
  liceoId: string;
  plantillaId: string;
  estudianteId: string;
  centroDualId: string;
  maestroGuiaId: string;
  asignacionId?: string;
  tipoEvaluador: TipoEvaluador;
  evaluadorUid: string;
  evaluadorNombre: string;
  evaluadorRol: Rol;
  fecha: string;
  respuestasLogros: Record<string, Record<string, NivelLogro>>;
  tareasAdicionales: TareaAdicionalEvaluacion[];
  respuestasDesarrolloPersonal: Record<string, NivelLogro>;
  observaciones?: string;
  resultados: {
    logrosPorcentaje: number;
    desarrolloPersonalPorcentaje: number;
    promedioGeneral: number;
  };
  estado: "completada";
  creadoPor: string;
  creadoEn: string;
  actualizadoEn?: string;
}
