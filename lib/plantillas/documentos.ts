import type { PlantillaDocumento } from "@/types/plantillas";
import type { SegmentoDocumento } from "@/types";

function p(texto: string): SegmentoDocumento {
  return { tipo: "protegido", texto };
}
function e(texto: string): SegmentoDocumento {
  return { tipo: "editable", texto };
}
function c(clave: string): SegmentoDocumento {
  return { tipo: "campo", texto: "", clave };
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
 * Solicitud de Permiso para ausentarse del Centro de Aprendizaje en
 * Alternancia Dual — calcada del formulario en papel que firma el Jefe de
 * Especialidad y del que toma conocimiento el Centro Dual.
 *
 * Los datos del estudiante se rellenan solos desde su ficha; lo que varía
 * en cada permiso (número, motivo, días, jornada, retiro) queda editable.
 *
 * La jornada va como texto marcable en vez de casillas porque el documento
 * se entrega en papel: quien lo imprime marca la que corresponde, igual
 * que en el talonario.
 */
const SOLICITUD_PERMISO: PlantillaDocumento = {
  id: "solicitud-permiso-dual",
  tipoModulo: "documento",
  nombre: "Solicitud de Permiso",
  descripcion: "Permiso para que un estudiante se ausente de su Centro de Aprendizaje en Alternancia Dual.",
  previewLineas: [
    `SOLICITUD DE PERMISO NRO. 01/${ANIO_ACTUAL}`,
    "Se solicita permiso para ausentarse del Centro de Aprendizaje.",
  ],
  requiereEstudiante: true,
  camposRequeridos: ["estudiante.nombreCompleto"],
  parrafos: [
    [p("SOLICITUD DE PERMISO NRO. "), e(`01/${ANIO_ACTUAL}`)],
    [p("Se solicita permiso para ausentarse del Centro de Aprendizaje en Alternancia Dual.")],
    [p("Nombre Estudiante: "), c("estudiante.nombreCompleto")],
    [p("Especialidad: "), c("especialidad.nombre")],
    [p("Curso: "), c("estudiante.nivel")],
    [p("Centro de Aprendizaje: "), c("centro.nombre")],
    [p("Motivo: "), e("")],
    [p("Día(s): "), e("")],
    [p("Marque lo que corresponda — Día Completo: ____  Media Jornada: ____  A.M.: ____  P.M.: ____")],
    [p("RETIRO: "), e("")],
    [e("")],
    [e("_______________________________")],
    [e("Nombre del Jefe de Especialidad")],
    [p("JEFE ESPECIALIDAD")],
    [e("")],
    [p("Toma de conocimiento Centro de Aprendizaje")],
    [e("")],
    [e("_______________________________")],
    [p("Nombre y Firma Centro Dual")],
  ],
};

/**
 * Plantillas de Documentos. "Circular" es la primera plantilla real de este
 * módulo; nuevas plantillas se agregan acá como entradas nuevas, sin tocar
 * el resto del sistema.
 */
export const PLANTILLAS_DOCUMENTOS: PlantillaDocumento[] = [CIRCULAR, SOLICITUD_PERMISO];
