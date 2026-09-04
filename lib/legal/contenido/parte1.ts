import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_1: ParteLegal = {
  id: "parte-1",
  numero: 1,
  titulo: "IDENTIFICACIÓN DEL RESPONSABLE DEL TRATAMIENTO Y MARCO JURÍDICO REGULATORIO",
  completo: true,
  secciones: [
    {
      id: "1-1",
      numero: "1.1.",
      titulo: "Identificación del Responsable del Tratamiento de Datos Personales",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En cumplimiento de las obligaciones de transparencia, información y responsabilidad proactiva (accountability) contempladas en el ordenamiento jurídico de la República de Chile, se formaliza la identificación del Responsable del Tratamiento y Custodio Operativo de las bases de datos personales y sensibles que son objeto de recopilación, almacenamiento, procesamiento y sistematización a través de la presente Plataforma de Gestión Académica y Formación Dual:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            { termino: "Identidad / Nombre Completo del Titular Responsable", descripcion: "Dionicio Gabriel Toyo Gutiérrez." },
            { termino: "Rol Operativo Institucional", descripcion: "Administrador del Sistema, Desarrollador Principal y Encargado de Protección de Datos Personales (Data Protection Officer / DPO)." },
            { termino: "Rol Único Tributario (R.U.T.)", descripcion: "26.901.591-8." },
            { termino: "Domicilio Legal y Administrativo", descripcion: "Villa Bicentenario, Calle 1, Pasaje 11, Casa 313, Comuna de Retiro, Región del Maule, República de Chile." },
            { termino: "Canal Oficial de Notificación y Asuntos de Privacidad", descripcion: "dionicio.toyo.gutierrez@gmail.com" },
          ],
        },
        {
          tipo: "parrafo",
          texto:
            "El Responsable del Tratamiento asume la obligación de velar por la observancia estricta de los estándares de seguridad informática, confidencialidad, disponibilidad e integridad de los activos de información y datos de carácter personal alojados e interconectados dentro del entorno web de la plataforma.",
        },
      ],
    },
    {
      id: "1-2",
      numero: "1.2.",
      titulo: "Marco Jurídico Regulatorio y Fundamentación Normativa",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "El tratamiento automatizado y no automatizado de datos personales efectuado en este sitio web se somete rigurosa y jerárquicamente al derecho positivo vigente en la República de Chile, estructurándose bajo las siguientes fuentes normativas y jurisprudenciales:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Constitución Política de la República de Chile",
              descripcion:
                "Artículo 19 N° 4: Garantía constitucional sustantiva que asegura a todas las personas el respeto y protección a la vida privada y a la honra de la persona y su familia, así como la protección de sus datos personales. El tratamiento y la manipulación de la información en este sitio web se supeditan estrictamente a la observancia de las formas y condiciones que determine la ley (principio de reserva legal).",
            },
            {
              termino: "Ley N° 19.628 sobre Protección de la Vida Privada",
              descripcion:
                "Marco normativo primario relativo al tratamiento de datos de carácter personal en registros o bancos de datos. Esta plataforma observa integralmente los principios de finalidad, proporcionalidad, calidad de los datos, seguridad y confidencialidad prescritos en dicho texto legal, exigiendo la autorización explícita para la recolección de datos y consagrando los derechos de acceso, rectificación, cancelación y bloqueo del titular.",
            },
            {
              termino: "Ley N° 21.719 que Modifica la Ley N° 19.628 e Introduce Exigencias de la Agencia de Protección de Datos Personales",
              descripcion:
                "Adecuación normativa formal alineada con los estándares internacionales (como el Reglamento General de Protección de Datos - RGPD / GDPR). Esta política incorpora los principios de responsabilidad proactiva (accountability), privacidad por diseño y por defecto (privacy by design and by default), la categorización de infracciones y las obligaciones relativas a la notificación de brechas de seguridad ante la autoridad de control estatal.",
            },
            {
              termino: "Ley N° 20.370 (Ley General de Educación - LGE) y Regulación Ministerial (MINEDUC)",
              descripcion:
                "Normativa que rige la actividad académica y la gestión de la información escolar dentro del sistema educativo chileno, imponiendo deberes específicos de resguardo, archivo, auditoría y trazabilidad sobre las fichas académicas, registros de asistencia y antecedentes de la Formación Profesional Técnica Dual de los estudiantes.",
            },
            {
              termino: "Tratados Internacionales y Convención sobre los Derechos del Niño",
              descripcion:
                "Instrumento internacional ratificado por Chile mediante el Decreto Supremo N° 830 del Ministerio de Relaciones Exteriores. La plataforma adecúa todo tratamiento de datos relativos a estudiantes menores de edad bajo la doctrina de la protección integral y el Principio del Interés Superior del Niño, garantizando que el tratamiento de datos no vulnere su desarrollo, privacidad o integridad moral.",
            },
            {
              termino: "Código Penal Chileno y Ley N° 21.459 sobre Delitos Informáticos",
              descripcion:
                "Disposiciones relativas al acceso ilícito a sistemas informáticos, interceptación de datos, falsificación informática, daño a datos informáticos y abuso de dispositivos, las cuales fundamentan las medidas de ciberseguridad adoptadas y las acciones legales aplicables ante conductas maliciosas de terceros o usuarios.",
            },
          ],
        },
      ],
    },
  ],
};
