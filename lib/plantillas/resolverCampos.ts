import type { ContextoResolucion } from "@/types/plantillas";

export interface ResultadoCampo {
  valor?: string;
  mensajeAusente?: string;
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
    "especialidad.nombre": especialidad ? { valor: especialidad.nombre } : { mensajeAusente: "No se encontró la especialidad del estudiante." },
    "centro.nombre": centro ? { valor: centro.nombre } : { mensajeAusente: "Este estudiante no tiene un centro dual asignado." },
    "centro.direccion": centro
      ? { valor: `${centro.direccion}${centro.comuna ? `, ${centro.comuna}` : ""}` }
      : { mensajeAusente: "Este estudiante no tiene un centro dual asignado." },
    "maestroGuia.nombreCompleto": maestroGuia
      ? { valor: `${maestroGuia.nombres} ${maestroGuia.apellidoPaterno}`.trim() }
      : { mensajeAusente: "Este estudiante no tiene un maestro guía asociado." },
    "profesorSupervisor.nombre": profesorSupervisor
      ? { valor: profesorSupervisor.nombre }
      : { mensajeAusente: "Este estudiante no tiene un profesor supervisor asignado." },
    "asignacion.fechaInicio": asignacionActiva?.fechaInicio
      ? { valor: asignacionActiva.fechaInicio }
      : { mensajeAusente: "Sin fecha de inicio registrada." },
    "asignacion.fechaTermino": asignacionActiva?.fechaTermino
      ? { valor: asignacionActiva.fechaTermino }
      : { mensajeAusente: "Sin fecha de término registrada." },
    "liceo.nombre": ctx.liceo?.nombre ? { valor: ctx.liceo.nombre } : { mensajeAusente: "No se encontró el liceo." },
    "liceo.comuna": ctx.liceo?.comuna ? { valor: ctx.liceo.comuna } : { mensajeAusente: "No se encontró la comuna del liceo." },
  };
}

/** Un estudiante es elegible para plantillas que requieren centro dual asignado (ej. Convenios). */
export function estudianteTieneCentroDualAsignado(estudianteId: string, ctx: ContextoResolucion): boolean {
  return ctx.asignaciones.some(
    (a) => a.estudianteId === estudianteId && (a.estado === "asignada" || a.estado === "activa") && Boolean(a.centroDualId)
  );
}
