import type { PlantillaEvaluacion } from "../tipos";

/**
 * Transcripción literal de la pauta física "LOGROS Y DESARROLLO PERSONAL
 * DEL APRENDIZ" (4° Año Contabilidad) que usa hoy el Maestro Guía — no se
 * reformula ni se reinterpreta ningún criterio. Plantilla fija por ahora
 * (sin editor todavía); cuando exista, esta es la que se cargará como
 * punto de partida por defecto.
 */
export const PLANTILLA_LOGROS_DESARROLLO_CONTABILIDAD_4: PlantillaEvaluacion = {
  id: "logros-desarrollo-4to-contabilidad",
  nombre: "Logros y Desarrollo Personal del Aprendiz",
  especialidad: "Contabilidad",
  nivel: "4° Año",
  tipoEvaluador: "maestro_guia",
  titulo: "ESPECIFICACION DE LAS ACTIVIDADES DEL ALUMNO EN EL PUESTO DE TRABAJO",
  porcentajeLogros: 70,
  porcentajeDesarrolloPersonal: 30,
  categoriasLogros: [
    {
      id: "cat-1",
      titulo: "Utiliza la Contabilidad como un sistema de información para la toma de decisiones",
      criterios: [
        { id: "cat-1-1", texto: "Relaciona los registros contables con la toma de decisiones con respecto a falta de insumos, disponibilidad en efectivo, etc." },
        { id: "cat-1-2", texto: "Discrimina correctamente a partir de los registros contables de una empresa, entre los activos, pasivos y patrimoniales" },
      ],
    },
    {
      id: "cat-2",
      titulo: "Realiza operaciones contables en registros básicos de una empresa.",
      criterios: [
        { id: "cat-2-1", texto: "Registra ordenada y cronológicamente las operaciones comerciales en los sistemas contables de la empresa." },
        { id: "cat-2-2", texto: "Realiza correctamente todos los registros contables utilizando software de contabilidad que posea la empresa." },
      ],
    },
    {
      id: "cat-3",
      titulo: "Maneja aplicaciones informáticas de carácter general.",
      criterios: [
        { id: "cat-3-1", texto: "Usa Software a nivel de usuario básico en planilla de cálculo, procesador de texto, bases de datos." },
        { id: "cat-3-2", texto: "Ingresa correctamente la información para su registro, archivo y su posterior procesamiento y así obtener resultados e informes." },
        { id: "cat-3-3", texto: "Ingresa correctamente la información en páginas web (SII, PREVIRED u otros) para el pago y /o declaraciones de impuestos, descuentos previsionales." },
      ],
    },
    {
      id: "cat-4",
      titulo: "Tareas Adicionales",
      criterios: [],
      permiteTareasDinamicas: true,
    },
  ],
  criteriosDesarrolloPersonal: [
    { id: "dp-1", texto: "Se presenta puntualmente a su jornada de Trabajo" },
    { id: "dp-2", texto: "Mantiene una buena presentación personal" },
    { id: "dp-3", texto: "Manifiesta disposición para realizar tareas encomendadas y se ofrece a ejecutarlas" },
    { id: "dp-4", texto: "Acepta positivamente las críticas y se esfuerza por rectificar sus errores" },
    { id: "dp-5", texto: "Aporta ideas propias al ejecutar tareas encomendadas" },
    { id: "dp-6", texto: "Demuestra interés y espíritu de superación a través de preguntas, observaciones y apoyo en tareas hacia sus superiores" },
    { id: "dp-7", texto: "A través de sus actitudes manifiesta valores tales como: Discreción, honestidad y compañerismo." },
    { id: "dp-8", texto: "Respeta el orden jerárquico, normas y reglamento interno de la empresa" },
  ],
};
