import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_11: ParteLegal = {
  id: "parte-11",
  numero: 11,
  titulo:
    "PROCEDIMIENTO DE MODIFICACIÓN DE LA POLÍTICA DE PRIVACIDAD, CRITERIOS DE ACTUALIZACIÓN NORMATIVA Y VÍAS DE NOTIFICACIÓN",
  completo: true,
  secciones: [
    {
      id: "11-1",
      numero: "11.1.",
      titulo: "Facultad de Actualización y Modificación Normativa",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "El Responsable del Tratamiento y Encargado de Protección de Datos de la plataforma se reserva el derecho absoluto, unilateral y discrecional de actualizar, modificar, enmendar o complementar total o parcialmente la presente Política de Privacidad y Tratamiento de Datos Personales, con el propósito ineludible de adaptarla a las continuas evoluciones tecnológicas, requerimientos operacionales del sistema de gestión académica, o a las directrices dimanantes de modificaciones legislativas, regulatorias e interpretativas del ordenamiento jurídico de la República de Chile, especialmente aquellas vinculadas a los estándares de la Ley N° 19.628, la Ley N° 21.719 y las resoluciones de la Agencia de Protección de Datos Personales.",
        },
        {
          tipo: "parrafo",
          texto:
            "Cualquier modificación efectuada a este cuerpo normativo entrará en vigor de forma inmediata a partir de su publicación oficial en el entorno web de la plataforma, salvo que en el propio texto enmendado se estipule expresamente un plazo superior de vacancia legal o entrada en vigencia diferida.",
        },
      ],
    },
    {
      id: "11-2",
      numero: "11.2.",
      titulo: "Criterios Taxativos de Actualización Obligatoria",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Las modificaciones sustanciales o accesorias a la presente política se producirán indefectiblemente bajo la concurrencia de uno o más de los siguientes criterios normativos y técnicos:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Reforma o Modificación del Marco Legal Vigente",
              descripcion:
                "Promulgación de nuevas leyes, reglamentos, decretos supremos o dictámenes de órganos fiscalizadores estatales (tales como el Ministerio de Educación o la Agencia de Protección de Datos Personales) que alteren los estándares de exigencia en materia de resguardo de datos sensibles, menores de edad o seguridad informática.",
            },
            {
              termino: "Implementación de Nuevas Funcionalidades Tecnológicas",
              descripcion:
                "Incorporación de nuevos módulos de gestión académica, herramientas de análisis pedagógico o actualizaciones en la arquitectura de infraestructura (Vercel/GitHub) que amplíen o modifiquen el ciclo de vida, flujo o tratamiento de los datos personales e institucionales.",
            },
            {
              termino: "Auditorías de Seguridad e Incidencias Técnicas",
              descripcion:
                "Derivación de recomendaciones o requerimientos preventivos surgidos de auditorías de ciberseguridad internas o externas destinadas a robustecer los protocolos de defensa perimetral (Zero Trust) y el control de acceso basado en roles (RBAC).",
            },
          ],
        },
      ],
    },
    {
      id: "11-3",
      numero: "11.3.",
      titulo: "Mecanismos y Vías de Notificación a la Comunidad Educativa",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En estricto cumplimiento del principio de transparencia informativa y debido proceso proactivo (accountability), el Responsable del Tratamiento se compromete a poner en conocimiento de la comunidad educativa (directivos, coordinadores, profesores guías, maestros guías, apoderados y alumnos) cualquier modificación relevante introducida en esta Política de Privacidad, utilizando los siguientes canales oficiales de notificación:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Publicación Actualizada en la Interfaz Web",
              descripcion:
                "El texto íntegro y modificado de la política estará disponible de manera permanente, pública y accesible en el apartado correspondiente del sitio web de la plataforma, consignando de forma clara en su encabezado la fecha exacta de la \"Última actualización\".",
            },
            {
              termino: "Notificación Telemática Institucional",
              descripcion:
                "En caso de modificaciones sustanciales que afecten directamente los derechos de los titulares o alteren sustancialmente las finalidades del tratamiento, el sistema remitirá una comunicación formal de aviso a través del correo electrónico institucional registrado (@dominio.cl) de cada usuario activo.",
            },
            {
              termino: "Aceptación Tácita o Expresa en el Siguiente Acceso",
              descripcion:
                "Al iniciar sesión con posterioridad a la implementación de una reforma normativa, la plataforma podrá requerir una revalidación o aceptación digital de la política actualizada como requisito técnico indispensable para continuar operando dentro de los módulos del sistema de gestión académica.",
            },
          ],
        },
      ],
    },
  ],
};
