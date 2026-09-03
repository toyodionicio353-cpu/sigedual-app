import type { ContextoResolucion } from "@/types/plantillas";
import { formatearFecha } from "@/lib/fecha";

export interface ResultadoCampo {
  valor?: string;
  mensajeAusente?: string;
}

function formatoFecha(iso?: string): string | undefined {
  return iso ? formatearFecha(iso) : undefined;
}

/**
 * Resuelve los campos automáticos de un estudiante a partir de las
 * relaciones reales de SIGEDUAL. La Asignacion activa (estado "asignada" o
 * "activa") es la fuente real de centro/maestro guía/profesor supervisor —
 * el Estudiante no las guarda de forma confiable de manera directa. Ningún
 * valor se inventa: si falta el dato o la relación, se devuelve un mensaje
 * honesto en su lugar.
 *
 * Nuevas claves para plantillas futuras se agregan acá, en un solo lugar.
 */
export function resolverCamposEstudiante(estudianteId: string, ctx: ContextoResolucion): Record<string, ResultadoCampo> {
  const estudiante = ctx.estudiantes.find((e) => e.id === estudianteId);
  if (!estudiante) return {};

  const asignacionActiva = ctx.asignaciones.find(
    (a) => a.estudianteId === estudianteId && (a.estado === "asignada" || a.estado === "activa")
  );
  const centro = asignacionActiva ? ctx.centros.find((c) => c.id === asignacionActiva.centroDualId) : undefined;
  const maestroGuia = asignacionActiva?.maestroGuiaId
    ? ctx.maestrosGuia.find((m) => m.id === asignacionActiva.maestroGuiaId)
    : undefined;
  const profesorSupervisor = asignacionActiva?.profesorSupervisorId
    ? ctx.profesores.find((p) => p.uid === asignacionActiva.profesorSupervisorId)
    : undefined;
  const especialidad = ctx.especialidades.find((e) => e.id === estudiante.especialidadId);

  return {
    "estudiante.nombreCompleto": { valor: `${estudiante.nombres} ${estudiante.apellidos}`.trim() },
    "estudiante.run": estudiante.run ? { valor: estudiante.run } : { mensajeAusente: "Este estudiante no tiene RUT registrado." },
    "estudiante.direccion": estudiante.direccion
      ? { valor: `${estudiante.direccion}${estudiante.comuna ? `, ${estudiante.comuna}` : ""}` }
      : { mensajeAusente: "Este estudiante no tiene domicilio registrado." },
    "estudiante.domicilio": estudiante.direccion
      ? { valor: estudiante.direccion }
      : { mensajeAusente: "Este estudiante no tiene domicilio registrado." },
    "estudiante.ciudad": estudiante.ciudad
      ? { valor: estudiante.ciudad }
      : { mensajeAusente: "Este estudiante no tiene ciudad registrada." },
    "estudiante.fechaNacimiento": formatoFecha(estudiante.fechaNacimiento)
      ? { valor: formatoFecha(estudiante.fechaNacimiento) }
      : { mensajeAusente: "Este estudiante no tiene fecha de nacimiento registrada." },
    "estudiante.nacionalidad": estudiante.nacionalidad
      ? { valor: estudiante.nacionalidad }
      : { mensajeAusente: "Este estudiante no tiene nacionalidad registrada en SIGEDUAL." },
    "estudiante.apoderadoNombre": estudiante.apoderadoNombre
      ? { valor: estudiante.apoderadoNombre }
      : { mensajeAusente: "Este estudiante no tiene un representante legal registrado." },
    "estudiante.apoderadoRun": estudiante.apoderadoRun
      ? { valor: estudiante.apoderadoRun }
      : { mensajeAusente: "Este estudiante no tiene el RUN del representante legal registrado." },
    "estudiante.apoderadoDomicilio": estudiante.apoderadoDomicilio
      ? { valor: estudiante.apoderadoDomicilio }
      : { mensajeAusente: "El domicilio del representante legal no está registrado en SIGEDUAL." },
    "estudiante.apoderadoCiudad": estudiante.apoderadoCiudad
      ? { valor: estudiante.apoderadoCiudad }
      : { mensajeAusente: "La ciudad del representante legal no está registrada en SIGEDUAL." },
    "estudiante.nivel": estudiante.nivel
      ? { valor: estudiante.nivel }
      : { mensajeAusente: "Este estudiante no tiene nivel/año de estudio registrado." },
    "especialidad.nombre": especialidad ? { valor: especialidad.nombre } : { mensajeAusente: "No se encontró la especialidad del estudiante." },
    "centro.nombre": centro ? { valor: centro.nombre } : { mensajeAusente: "Este estudiante no tiene un centro dual asignado." },
    "centro.direccion": centro
      ? { valor: `${centro.direccion}${centro.comuna ? `, ${centro.comuna}` : ""}` }
      : { mensajeAusente: "Este estudiante no tiene un centro dual asignado." },
    "centro.domicilio": centro
      ? { valor: centro.direccion }
      : { mensajeAusente: "Este estudiante no tiene un centro dual asignado." },
    "centro.ciudad": centro?.ciudad
      ? { valor: centro.ciudad }
      : { mensajeAusente: "El centro dual no tiene ciudad registrada." },
    "centro.contactoNombre": centro?.contactoNombre
      ? { valor: centro.contactoNombre }
      : { mensajeAusente: "El centro dual no tiene un representante/contacto registrado." },
    "centro.contactoCargo": centro?.contactoCargo
      ? { valor: centro.contactoCargo }
      : { mensajeAusente: "El centro dual no tiene el cargo del representante/contacto registrado." },
    "maestroGuia.nombreCompleto": maestroGuia
      ? { valor: `${maestroGuia.nombres} ${maestroGuia.apellidoPaterno}`.trim() }
      : { mensajeAusente: "Este estudiante no tiene un maestro guía asociado." },
    "profesorSupervisor.nombre": profesorSupervisor
      ? { valor: profesorSupervisor.nombre }
      : { mensajeAusente: "Este estudiante no tiene un profesor supervisor asignado." },
    "asignacion.fechaInicio": formatoFecha(asignacionActiva?.fechaInicio)
      ? { valor: formatoFecha(asignacionActiva?.fechaInicio) }
      : { mensajeAusente: "Sin fecha de inicio registrada." },
    "asignacion.fechaTermino": formatoFecha(asignacionActiva?.fechaTermino)
      ? { valor: formatoFecha(asignacionActiva?.fechaTermino) }
      : { mensajeAusente: "Sin fecha de término registrada." },
    "liceo.nombre": ctx.liceo?.nombre ? { valor: ctx.liceo.nombre } : { mensajeAusente: "No se encontró el liceo." },
    "liceo.comuna": ctx.liceo?.comuna ? { valor: ctx.liceo.comuna } : { mensajeAusente: "No se encontró la comuna del liceo." },
  };
}

/**
 * Campos que no dependen de un estudiante, sino del propio documento (ej.
 * la fecha en que se redacta el convenio). "documento.fechaCreacion" se
 * resuelve al momento de crear el registro y luego queda fija: al reabrir
 * un documento guardado, EditorDocumento usa el valor almacenado en
 * `campos` en vez de recalcular esta función.
 */
export function resolverCamposDocumento(): Record<string, ResultadoCampo> {
  return {
    "documento.fechaCreacion": { valor: new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" }) },
    "documento.anio": { valor: String(new Date().getFullYear()) },
    // El Decreto N° 313 (Ministerio del Trabajo y Previsión Social) fue promulgado
    // el 27 de diciembre de 1972 y publicado en el Diario Oficial el 12 de mayo
    // de 1973. Es un dato legal fijo, no depende del estudiante ni del liceo.
    "documento.fechaPublicacionDecreto": { valor: "12 de mayo de 1973" },
  };
}

/** Un estudiante es elegible para plantillas que requieren centro dual asignado (ej. Convenios). */
export function estudianteTieneCentroDualAsignado(estudianteId: string, ctx: ContextoResolucion): boolean {
  return ctx.asignaciones.some(
    (a) => a.estudianteId === estudianteId && (a.estado === "asignada" || a.estado === "activa") && Boolean(a.centroDualId)
  );
}
