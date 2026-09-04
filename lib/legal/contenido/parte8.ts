import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_8: ParteLegal = {
  id: "parte-8",
  numero: 8,
  titulo:
    "POLÍTICA DE RETENCIÓN, PLAZO DE CONSERVACIÓN DE LOS DATOS (REGLA DE LOS 5 AÑOS), FUNDAMENTO NORMATIVO MINEDUC Y PROTOCOLOS DE DESTRUCCIÓN O ANONIMIZACIÓN SEGURA",
  completo: true,
  secciones: [
    {
      id: "8-1",
      numero: "8.1.",
      titulo: "Principio de Limitación del Plazo de Conservación y Regla Temporal de Retención",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En estricta sujeción al Principio de Calidad y Proporcionalidad de los Datos consagrado en la legislación sobre protección de la vida privada, la plataforma establece que los datos personales, académicos, administrativos y sensibles (de salud) recopilados no serán conservados en los sistemas informáticos por un período superior al estrictamente necesario para la consecución de los fines teleológicos que motivaron su recolección y procesamiento.",
        },
        {
          tipo: "parrafo",
          texto:
            "Se fija como plazo máximo, general e imperativo de retención de la información el término de cinco (5) años, contados de manera inexorable a partir de la fecha de finalización del respectivo período académico, año lectivo, proceso de práctica dual o de la fecha de emisión del documento administrativo o justificativo médico correspondiente.",
        },
      ],
    },
    {
      id: "8-2",
      numero: "8.2.",
      titulo: "Fundamento Legal y Exigencias Normativas del Ministerio de Educación (MINEDUC)",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "La adopción del plazo de conservación quinquenal (5 años) no obedece a criterios arbitrarios, sino que responde directamente al cumplimiento de las obligaciones legales, tributarias, administrativas y de auditoría institucional impuestas a los establecimientos educacionales de la República de Chile por el ordenamiento jurídico y los cuerpos normativos del Ministerio de Educación (MINEDUC) y la Superintendencia de Educación:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Trazabilidad de Procesos Educativos y Fiscalización",
              descripcion:
                "Los cuerpos normativos que regulan la subvención escolar, la validez de los estudios y la certificación de la enseñanza media exigen a las instituciones educativas mantener respaldos verificables e íntegros del historial de asistencia, actas de calificaciones, resoluciones de permisos y justificaciones de inasistencia.",
            },
            {
              termino: "Resguardo ante Auditorías y Requerimientos Estatales",
              descripcion:
                "El plazo de cinco años garantiza que la institución disponga de la capacidad material y documental para responder con absoluta fidelidad y transparencia ante eventuales fiscalizaciones, auditorías ministeriales, investigaciones administrativas o requerimientos judiciales que pudieren promoverse con posterioridad al egreso o titulación del estudiante.",
            },
          ],
        },
      ],
    },
    {
      id: "8-3",
      numero: "8.3.",
      titulo: "Protocolos Técnicos de Destrucción Física, Borrado Lógico y Anonimización Segura",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Una vez cumplido íntegramente el plazo de retención de cinco (5) años, o cuando el titular de los datos ejerza de manera procedente su derecho de cancelación (supresión) en el marco de la normativa aplicable, el Responsable del Tratamiento procederá a la ejecución irreversible de los protocolos de eliminación de la información:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Borrado Lógico y Destrucción de Registros Relacionales",
              descripcion:
                "Se ejecutarán sentencias de supresión segura y definitiva (Secure Erase) sobre las filas, tablas y esquemas de la base de datos relacional vinculadas al usuario o cohorte respectiva, eliminando cualquier rastro activo de los datos de identidad, expedientes académicos y archivos de salud adjuntos.",
            },
            {
              termino: "Purgado de Repositorios en la Nube y Caché de Servidores",
              descripcion:
                "Se vaciarán de forma definitiva los contenedores de almacenamiento de objetos y archivos (Object Storage) asociados a Vercel o GitHub donde reposaran los documentos escaneados o digitalizados, asegurando la inexistencia de copias de respaldo (backups) activas de dichos registros específicos.",
            },
            {
              termino: "Anonimización Irreversible como Alternativa Estadística",
              descripcion:
                "En aquellos supuestos en los cuales la institución requiera conservar métricas de rendimiento globales con fines estrictamente estadísticos o de investigación pedagógica, se aplicarán procesos de disociación y anonimización irreversible, alterando matemáticamente o removiendo de forma permanente todo parámetro o atributo que permita vincular los datos cuantitativos con la identidad de una persona natural determinada o determinable, transformando la información en un registro puramente anónimo e indescifrable.",
            },
          ],
        },
      ],
    },
  ],
};
