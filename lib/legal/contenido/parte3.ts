import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
//
// NOTA DE INTEGRIDAD (no forma parte del texto legal, es solo una nota de
// desarrollo): el texto recibido para esta parte se corta a mitad de frase
// en la sección 3.2 ("...bajo la figura de justificaciones médicas,
// certificados de salud"). Se transcribe exactamente hasta ese punto, sin
// completar la frase por inferencia. `completo: false` refleja esto para
// que la interfaz lo señale como pendiente de completar.
export const PARTE_3: ParteLegal = {
  id: "parte-3",
  numero: 3,
  titulo: "TAXONOMÍA, TIPOLOGÍA Y CLASIFICACIÓN DE LOS DATOS PERSONALES Y SENSIBLES OBJETO DE TRATAMIENTO",
  completo: false,
  secciones: [
    {
      id: "3-1",
      numero: "3.1.",
      titulo: "Categorización de Datos Personales de Carácter Regular y Académico",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En estricta observancia del Principio de Minimización, Proporcionalidad y Finalidad consagrado en la legislación de protección de datos, la plataforma procede a la recopilación, almacenamiento y sistematización de un conjunto delimitado, específico y taxativo de datos. La recolección se circunscribe de manera exclusiva a aquellos antecedentes que resultan idóneos, pertinentes y estrictamente necesarios para la operatividad del sistema de gestión escolar y la administración de la formación técnico-profesional dual.",
        },
        {
          tipo: "parrafo",
          texto: "La taxonomía de los datos personales regulares sometidos a tratamiento comprende las siguientes categorías:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Datos de Identidad e Individualización",
              descripcion:
                "Nombres y apellidos completos, y Rol Único Nacional (R.U.N. / R.U.T.) del estudiante, docente o funcionario, con el propósito unívoco de garantizar la correcta identificación legal dentro del sistema educativo y evitar la suplantación de identidad o duplicidad de registros en la asignación de cupos de práctica.",
            },
            {
              termino: "Datos de Contacto y Credenciales Institucionales",
              descripcion:
                "Se captura y exige, con carácter de obligatoriedad ineludible, el uso de direcciones de correo electrónico provistas de un dominio institucional válido y acreditado (@dominio.cl). Se excluye deliberadamente la recopilación y uso de correos electrónicos personales (genéricos) para la creación de cuentas de usuario.",
            },
            {
              termino: "Datos de Naturaleza Académica, Formativa y Administrativa",
              descripcion:
                "Antecedentes relativos al historial de rendimiento escolar, registro sistemático de asistencia a clases y a los centros de formación dual, actas de evaluación, informes de desempeño, cartas de compromiso, autorizaciones emitidas por la dirección o apoderados, y los respectivos roles, cargos o niveles académicos asociados a cada perfil dentro de la arquitectura de la plataforma.",
            },
          ],
        },
      ],
    },
    {
      id: "3-2",
      numero: "3.2.",
      titulo: "Tratamiento Restrictivo y Custodia Reforzada de Datos Sensibles (Categoría de Salud)",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En conformidad con lo dispuesto en la letra g) del artículo 2° y el artículo 10° de la Ley N° 19.628 sobre Protección de la Vida Privada, la plataforma reconoce y clasifica como Datos Sensibles a toda aquella información concerniente a los estados de salud físicos o psíquicos de los estudiantes.",
        },
        {
          tipo: "parrafo",
          texto:
            "La plataforma contempla la ingesta, almacenamiento y procesamiento transitorio de datos de salud única y exclusivamente bajo la figura de justificaciones médicas, certificados de salud",
        },
      ],
    },
  ],
};
