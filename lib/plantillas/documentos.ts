import type { PlantillaDocumento } from "@/types/plantillas";
import type { SegmentoDocumento } from "@/types";

function p(texto: string): SegmentoDocumento {
  return { tipo: "protegido", texto };
}
function e(texto: string): SegmentoDocumento {
  return { tipo: "editable", texto };
}

// Se calcula una sola vez al cargar el módulo (en el navegador de quien usa
// la plantilla), solo para sugerir un valor inicial de "Nro." y "Fecha" —
// el resultado queda como texto editable normal, nunca como un campo fijo.
const ANIO_ACTUAL = new Date().getFullYear();

const CIRCULAR: PlantillaDocumento = {
  id: "circular",
  tipoModulo: "documento",
  nombre: "Circular",
  descripcion: "Circular oficial para comunicar novedades de la Formación Profesional Dual.",
  previewLineas: [
    `CIRCULAR NRO. 06/${ANIO_ACTUAL}`,
    "DE: (emisor) — A: (destinatarios) — MAT.: (materia)",
  ],
  requiereEstudiante: false,
  camposRequeridos: [],
  parrafos: [
    [p("CIRCULAR NRO. "), e(`06/${ANIO_ACTUAL}`)],
    [p("DE: "), e("Director Liceo Bicentenario Guillermo Marín Larraín – Retiro")],
    [p("A: "), e("MAESTROS y MAESTRAS GUÍAS")],
    [p("MAT.: "), e("Informa Suspensión Formación Dual")],
    [p("LUGAR Y FECHA: "), e(`RETIRO, agosto 19 del ${ANIO_ACTUAL}.`)],
    [e("Estimados Maestros y Maestras Guías:")],
    [e("Informamos a Uds. que el día viernes 21 del presente, los estudiantes no podrán asistir a su Aprendizaje en la Empresa por tener la última clase de su curso de capacitación.")],
    [e("Este cambio de actividad no está contemplado en el calendario enviado a Uds., es originado para recuperar horas de clases por suspensiones y para acreditar el total de horas que contempla la capacitación.")],
    [e("Seguros de contar como siempre con su comprensión, le saluda cordialmente.")],
    [e("_______________________________")],
    [e("Nombre del firmante")],
    [e("Cargo del firmante")],
  ],
};

/**
 * Plantillas de Documentos. "Circular" es la primera plantilla real de este
 * módulo; nuevas plantillas se agregan acá como entradas nuevas, sin tocar
 * el resto del sistema.
 */
export const PLANTILLAS_DOCUMENTOS: PlantillaDocumento[] = [CIRCULAR];
