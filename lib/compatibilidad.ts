import type { Asignacion, CentroDual, Compatibilidad, Estudiante, FactorCompatibilidad } from "@/types";
import { EQUIVALENCIAS_RASGO_AMBIENTE } from "./caracteristicas";

// Pesos del puntaje de compatibilidad. La disponibilidad (activo + cupos) no
// se pondera acá: es una condición obligatoria que filtra la lista de
// "recomendados" en el caller (ver disponibleParaRecomendar), no un factor de
// puntaje. Editar estos valores para ajustar el algoritmo.
export const PESOS = {
  especialidad: 0.4,
  caracteristicas: 0.3,
  habilidades: 0.3,
};

export function calcularCompatibilidad(estudiante: Estudiante, centro: CentroDual): Compatibilidad {
  const coincidencias: FactorCompatibilidad[] = [];
  const advertencias: FactorCompatibilidad[] = [];

  // --- Especialidad ---
  const especialidadCompatible = centro.especialidades.includes(estudiante.especialidadId);
  const especialidadScore = especialidadCompatible ? 1 : 0;
  if (especialidadCompatible) {
    coincidencias.push({ tipo: "especialidad", descripcion: "Especialidad compatible con la formación del estudiante" });
  } else {
    advertencias.push({ tipo: "advertencia", descripcion: "Este centro no está asociado a la especialidad del estudiante" });
  }

  // --- Características (rasgos del estudiante vs. ambiente del centro) ---
  const ambientesCentro = centro.caracteristicas ?? [];
  const rasgosEstudiante = estudiante.rasgos ?? [];
  const ambientesCoincidentes = new Set<string>();
  for (const rasgo of rasgosEstudiante) {
    const compatibles = EQUIVALENCIAS_RASGO_AMBIENTE[rasgo] ?? [];
    for (const ambiente of ambientesCentro) {
      if (compatibles.includes(ambiente)) ambientesCoincidentes.add(ambiente);
    }
  }
  const caracteristicasScore = ambientesCentro.length > 0 ? ambientesCoincidentes.size / ambientesCentro.length : 0;
  for (const ambiente of ambientesCoincidentes) {
    coincidencias.push({ tipo: "caracteristica", descripcion: `${ambiente} coincide con las preferencias registradas del estudiante` });
  }
  if (ambientesCentro.length > 0 && ambientesCoincidentes.size === 0) {
    advertencias.push({ tipo: "advertencia", descripcion: "El ambiente declarado por el centro no coincide con las preferencias registradas del estudiante" });
  }

  // --- Habilidades (vocabulario compartido, comparación directa) ---
  const habilidadesCentro = centro.habilidadesValoradas ?? [];
  const habilidadesEstudiante = estudiante.habilidades ?? [];
  const habilidadesCoincidentes = habilidadesCentro.filter((h) => habilidadesEstudiante.includes(h));
  const habilidadesScore = habilidadesCentro.length > 0 ? habilidadesCoincidentes.length / habilidadesCentro.length : 0;
  for (const h of habilidadesCoincidentes) {
    coincidencias.push({ tipo: "habilidad", descripcion: `${h} coincide con las habilidades registradas del estudiante` });
  }

  // --- Información insuficiente ---
  const limitada = ambientesCentro.length === 0 && habilidadesCentro.length === 0;
  if (limitada) {
    return { puntaje: null, limitada: true, coincidencias, advertencias };
  }

  const puntaje = Math.round(
    especialidadScore * PESOS.especialidad * 100 +
    caracteristicasScore * PESOS.caracteristicas * 100 +
    habilidadesScore * PESOS.habilidades * 100
  );

  return { puntaje, limitada: false, coincidencias, advertencias };
}

// Centros creados antes de agregar el campo `estado`/`capacidad` solo tienen
// el booleano `activo` y `cuposDisponibles` — estos helpers leen el campo
// nuevo cuando existe y si no, derivan el equivalente del campo antiguo, para
// que ningún centro ya creado cambie de comportamiento.
export function estadoEfectivo(centro: CentroDual): "activo" | "inactivo" | "en_revision" {
  if (centro.estado) return centro.estado;
  return centro.activo === false ? "inactivo" : "activo";
}

export function capacidadDe(centro: CentroDual): number | undefined {
  return centro.capacidad ?? centro.cuposDisponibles;
}

export function disponibilidadDe(centro: CentroDual, asignaciones: Asignacion[]) {
  const ocupados = asignaciones.filter(
    (a) => a.centroDualId === centro.id && (a.estado === "asignada" || a.estado === "activa")
  ).length;
  const capacidad = capacidadDe(centro);
  return { capacidad, ocupados, disponibles: capacidad == null ? undefined : Math.max(0, capacidad - ocupados) };
}

// Un centro es "recomendable" (aparece en la lista de recomendados) si está
// activo y, cuando declara capacidad, todavía tiene cupos libres. Esto NO
// excluye al centro de la selección manual ("todos los centros") — solo
// prioriza la lista automática, tal como pide el requerimiento: la
// recomendación es una herramienta de apoyo, no una restricción.
export function disponibleParaRecomendar(centro: CentroDual, asignacionesActivas: Asignacion[]): boolean {
  if (estadoEfectivo(centro) !== "activo") return false;
  const capacidad = capacidadDe(centro);
  if (capacidad == null) return true;
  const cuposUsados = asignacionesActivas.filter(
    (a) => a.centroDualId === centro.id && (a.estado === "asignada" || a.estado === "activa")
  ).length;
  return cuposUsados < capacidad;
}

// Campos importantes que, si faltan, hacen que un centro quede marcado como
// "Información incompleta" en el listado y la ficha.
export function camposFaltantes(centro: CentroDual): string[] {
  const faltantes: string[] = [];
  if (centro.especialidades.length === 0) faltantes.push("Especialidad");
  if (capacidadDe(centro) == null) faltantes.push("Capacidad");
  if (!centro.contactoNombre && !centro.contactoEmail && !centro.contactoTelefono) faltantes.push("Contacto");
  if (!centro.region) faltantes.push("Ubicación completa");
  if ((centro.caracteristicas ?? []).length === 0) faltantes.push("Características");
  if ((centro.habilidadesValoradas ?? []).length === 0) faltantes.push("Habilidades");
  return faltantes;
}
