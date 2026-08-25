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
  email?: string;
  telefono?: string;
  curso: string;
  nivel: string;
  especialidadId: string;
  liceoId: string;
  centroDualId?: string;
  profesorId?: string;
  estado: "activo" | "inactivo" | "egresado";
  creadoEn: string;
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
