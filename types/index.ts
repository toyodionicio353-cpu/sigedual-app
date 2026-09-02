export type Rol = "administrador" | "coordinador" | "director" | "profesor" | "centro_dual" | "estudiante";

export interface Usuario {
  uid: string;
  email: string;
  nombre: string;
  rol: Rol;
  especialidad?: string;
  liceoId: string;
  activo: boolean;
  creadoEn: string;
}

export interface Liceo {
  id: string;
  nombre: string;
  rbd: string;
  comuna: string;
  region: string;
  direccion: string;
  telefono?: string;
  email?: string;
  dominioCorreo?: string;
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
  apoderadoNombre?: string;
  apoderadoRun?: string;
  apoderadoParentesco?: string;
  apoderadoTelefono?: string;
  apoderadoEmail?: string;
  observaciones?: string;
  creadoEn: string;
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

export interface CentroDual {
  id: string;
  nombre: string;
  rut: string;
  direccion: string;
  comuna: string;
  telefono?: string;
  email?: string;
  maestroGuia: string;
  telefonoMaestro?: string;
  emailMaestro?: string;
  liceoId: string;
  especialidades: string[];
  activo: boolean;
}
