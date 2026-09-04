import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_2: ParteLegal = {
  id: "parte-2",
  numero: 2,
  titulo: "ÁMBITO DE APLICACIÓN SUBJETIVO, OBJETIVO Y RÉGIMEN DE PROTECCIÓN REFORZADA DEL MENOR DE EDAD",
  completo: true,
  secciones: [
    {
      id: "2-1",
      numero: "2.1.",
      titulo: "Ámbito de Aplicación Subjetivo (Sujetos y Perfiles Intervinientes)",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "La presente Política de Privacidad y Tratamiento de Datos Personales posee un carácter erga omnes dentro del ecosistema de la plataforma, resultando de acatamiento obligatorio, inexcusable e imperativo para toda persona natural o jurídica que, de manera directa o indirecta, interactúe con el entorno virtual, las bases de datos o los flujos de información del sistema.",
        },
        {
          tipo: "parrafo",
          texto:
            "En consecuencia, el ámbito de aplicación subjetivo se circunscribe y vincula jurídicamente a la totalidad de los perfiles de usuarios autorizados, categorizados en las siguientes nomenclaturas funcionales:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Administrador / Desarrollador Técnico",
              descripcion:
                "Sujeto con privilegios de superusuario, responsable del mantenimiento, despliegue en infraestructura web, auditoría de código y gestión de bases de datos, obrando bajo el deber de secreto profesional continuo.",
            },
            {
              termino: "Director y Equipo Directivo Institucional",
              descripcion:
                "Autoridad máxima del establecimiento educacional con atribuciones de visualización global, gestión institucional y facultad de emisión de códigos de verificación criptográfica temporal para el alta de nuevos usuarios.",
            },
            {
              termino: "Coordinador TP (Técnico-Profesional)",
              descripcion:
                "Personal administrativo-docente encargado de la intermediación, supervisión y sistematización de los registros derivados de la formación dual y el encadenamiento académico-laboral.",
            },
            {
              termino: "Profesor Guía / Docente Tutor",
              descripcion:
                "Profesional de la educación que accede de forma sectorizada y restrictiva, única y exclusivamente a los expedientes, métricas de rendimiento y asistencia de la cohorte de estudiantes que se encuentran bajo su tutela y responsabilidad académica directa.",
            },
            {
              termino: "Alumnos (Titulares Principales de los Datos)",
              descripcion:
                "Estudiantes regulares matriculados en la institución educativa, en calidad de titulares de los derechos emanados sobre sus propios datos personales, provistos de un acceso estrictamente unidireccional, individual, confidencial e intransferible a su propia información, quedando bloqueada por sistema cualquier eventual visualización de expedientes de terceros.",
            },
            {
              termino: "Centros Duales y Maestros Guías",
              descripcion:
                "Personas naturales o jurídicas externas a la institución educativa (empresas, talleres, centros de práctica profesional) que asumen el rol de tutores laborales. Su acceso se encuentra segmentado, parcelado y limitado de manera hermética a la información estrictamente necesaria del alumno específicamente asignado a su centro para el desarrollo de su práctica o proceso de formación dual, quedando sujetos a cláusulas de confidencialidad análogas a las del establecimiento.",
            },
          ],
        },
      ],
    },
    {
      id: "2-2",
      numero: "2.2.",
      titulo: "Ámbito de Aplicación Objetivo (Operaciones de Tratamiento)",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Desde una perspectiva material y objetiva, este cuerpo normativo interno rige, condiciona y reglamenta absolutamente toda operación o conjunto de operaciones efectuadas sobre los datos personales, ya sea mediante procedimientos automatizados o no automatizados.",
        },
        {
          tipo: "parrafo",
          texto:
            "El ámbito objetivo abarca de manera taxativa, aunque no limitativa, las siguientes fases del ciclo de vida del dato: recolección, captura, registro, organización, estructuración, conservación, custodia, adaptación, modificación, extracción, consulta, utilización, comunicación por transmisión, difusión, interconexión, bloqueo, anonimización, seudonimización y supresión o destrucción física y/o lógica de la información ingresada a la arquitectura de la plataforma.",
        },
      ],
    },
    {
      id: "2-3",
      numero: "2.3.",
      titulo: "Régimen de Protección Reforzada y Tutela del Menor de Edad",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Considerando la naturaleza intrínseca de la plataforma como instrumento de gestión académica, y atendiendo a que el público objetivo primario se compone mayoritariamente de estudiantes que cursan la etapa de Enseñanza Media y que, por consiguiente, ostentan la calidad jurídica de menores de edad (niños, niñas y adolescentes), el tratamiento de su información personal se encuentra supeditado a un escrutinio de legalidad excepcionalmente riguroso.",
        },
        {
          tipo: "parrafo",
          texto:
            "Se consagra y materializa, bajo las directrices del ordenamiento jurídico chileno y la Convención Internacional sobre los Derechos del Niño, un régimen de tutela y protección reforzada de datos, fundamentado en los siguientes axiomas irrenunciables:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Principio del Interés Superior del Adolescente",
              descripcion:
                "Toda operación de tratamiento de datos personales, académicos o sensibles referidos a estudiantes menores de edad persigue como teleología única, exclusiva y excluyente la consecución de fines orientados a su desarrollo educativo, bienestar estudiantil y progresión en su formación técnico-profesional. Cualquier uso ajeno a estas finalidades se encuentra terminante y absolutamente prohibido.",
            },
            {
              termino: "Consentimiento por Representación y Entorno Institucional",
              descripcion:
                "La captura y tratamiento de datos de menores se valida, legitima y ampara bajo la figura del consentimiento otorgado en el momento de la matrícula escolar por parte de los padres, apoderados o representantes legales que ejercen la patria potestad. Asimismo, el tratamiento se realiza bajo el mandato de la relación educativa formal, operando el establecimiento educacional y la plataforma como entidades encargadas de vehiculizar la gestión académica previamente autorizada.",
            },
            {
              termino: "Inmunidad Comercial y Publicitaria Absoluta",
              descripcion:
                "Se prohíbe de manera absoluta, perpetua e incondicional el sometimiento de los datos de menores de edad a procesos de perfilamiento algorítmico (profiling), mercadotecnia, monetización, cesión a terceros ajenos al proceso educativo o cualquier otra operación de naturaleza comercial, garantizando un entorno digital exento de mercantilización de la identidad del estudiante.",
            },
          ],
        },
      ],
    },
  ],
};
