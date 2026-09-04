import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_9: ParteLegal = {
  id: "parte-9",
  numero: 9,
  titulo:
    "EJERCICIO DE LOS DERECHOS DE LOS TITULARES (DERECHOS ARCO, PORTABILIDAD Y OPOSICIÓN) Y PROCEDIMIENTO FORMAL DE ATENCIÓN EN 24 HORAS HÁBILES",
  completo: true,
  secciones: [
    {
      id: "9-1",
      numero: "9.1.",
      titulo: "Reconocimiento y Alcance de los Derechos de Control sobre los Datos Personales",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En estricta concordancia con los estándares consagrados en la Ley N° 19.628 sobre Protección de la Vida Privada y las directrices de adecuación incorporadas por la Ley N° 21.719 en el ordenamiento jurídico de la República de Chile, se reconoce a todo titular de datos (o a sus representantes legales o apoderados debidamente acreditados en el caso de estudiantes menores de edad que cursan enseñanza media) la titularidad indiscutible de sus prerrogativas de control sobre su información personal y académica.",
        },
        {
          tipo: "parrafo",
          texto:
            "El sistema garantiza el ejercicio libre, expedito y gratuito de los denominados Derechos ARCO, además de los derechos de portabilidad y oposición, bajo las siguientes definiciones sustantivas:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Derecho de Acceso",
              descripcion:
                "Facultad del titular para obtener del Responsable del Tratamiento la confirmación acerca de si sus datos personales están siendo o no objeto de tratamiento, así como el acceso detallado a la información contenida en sus fichas académicas, registros de asistencia, metadatos de acceso y antecedentes médicos o de salud vinculados a su expediente.",
            },
            {
              termino: "Derecho de Rectificación",
              descripcion:
                "Potestad orientada a exigir la modificación, corrección o actualización inmediata de aquellos datos de carácter personal que resulten inexactos, equívocos, desactualizados, incompletos o falsos, aportando los antecedentes justificatorios que validen la enmienda solicitada.",
            },
            {
              termino: "Derecho de Cancelación (Supresión o Borrado)",
              descripcion:
                "Derecho potestativo del titular para solicitar la eliminación total o parcial de sus registros de las bases de datos de la plataforma, el cual procederá de manera automática siempre y cuando no existan obligaciones legales vigentes de retención obligatoria (tales como la regla quinquenal de conservación exigida por la normativa del Ministerio de Educación).",
            },
            {
              termino: "Derecho de Oposición",
              descripcion:
                "Facultad del usuario para manifestar su negativa fundamentada al tratamiento de sus datos personales bajo circunstancias legítimas y particulares, impidiendo el procesamiento de los mismos cuando no medie un mandato institucional o contractual imperativo.",
            },
            {
              termino: "Derecho de Portabilidad de los Datos",
              descripcion:
                "Atribución orientada a recibir los datos personales que le incumben en un formato estructurado, de uso común y lectura mecánica, o a solicitar su transmisión directa a otro responsable técnico cuando técnicamente fuere procedente y compatible con la arquitectura del sistema.",
            },
          ],
        },
      ],
    },
    {
      id: "9-2",
      numero: "9.2.",
      titulo:
        "Procedimiento Formal, Canal Único de Solicitud y Plazo de Respuesta Excepcional de 24 Horas Hábiles",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Con el propósito de garantizar una respuesta oportuna, transparente y ajustada a los principios de responsabilidad proactiva (accountability), el procedimiento formal para el ejercicio de cualquiera de los Derechos ARCO, de portabilidad o de oposición se somete estrictamente a las siguientes reglas operativas:",
        },
        {
          tipo: "parrafo",
          texto:
            "Canal Único y Exclusivo de Recepción: Toda solicitud, requerimiento o petición formal relativa a la privacidad, acceso o supresión de datos deberá ser remitida obligatoriamente por escrito mediante correo electrónico dirigido a la casilla oficial y exclusiva habilitada al efecto: dionicio.toyo.gutierrez@gmail.com",
        },
        {
          tipo: "parrafo",
          texto:
            "Requisitos Formales Mínimos de la Solicitud: Para evitar suplantaciones de identidad y proteger la privacidad del titular o del menor de edad, el correo electrónico remitente deberá contener:",
        },
        {
          tipo: "lista",
          items: [
            "Identificación fehaciente del peticionario (Nombre completo y R.U.T.).",
            "Acreditación de la calidad de titular o de representante legal / apoderado del estudiante menor de edad.",
            "Descripción clara, precisa e inequívoca del derecho que se desea ejercer (Acceso, Rectificación, Cancelación, Oposición o Portabilidad).",
            "Documentos de respaldo o sustento que justifiquen la solicitud (en caso de requerir rectificaciones).",
          ],
        },
        {
          tipo: "parrafo",
          texto:
            "Plazo de Respuesta perentorio de 24 Horas Hábiles: El Responsable del Tratamiento y Encargado de Protección de Datos se obliga formalmente a emitir una respuesta de fondo, fundamentada y digitalmente estructurada a la solicitud planteada dentro de un plazo máximo improrrogable de 24 horas hábiles (entendiéndose por tal el lapso equivalente antes de las 23:59 horas del día hábil subsiguiente a la recepción formal del correo electrónico de petición en los servidores).",
        },
      ],
    },
  ],
};
