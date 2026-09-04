import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_4: ParteLegal = {
  id: "parte-4",
  numero: 4,
  titulo: "FINALIDAD ESPECÍFICA DEL TRATAMIENTO, BASE DE LICITUD Y PROHIBICIÓN ABSOLUTA DE COMERCIALIZACIÓN",
  completo: true,
  secciones: [
    {
      id: "4-1",
      numero: "4.1.",
      titulo: "Finalidad Específica, Exclusiva y Teleología del Tratamiento",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En irrestricto apego al Principio de Finalidad consagrado en la legislación nacional sobre protección de la vida privada (Ley N° 19.628 y sus modificaciones sustanciales introducidas por la Ley N° 21.719), se declara de manera categórica que los datos personales, académicos y sensibles recopilados carecen de cualquier propósito subrepticio. La ingesta, almacenamiento y procesamiento de la información obedece única, exclusiva y excluyentemente a las siguientes teleologías o fines operacionales y administrativos:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Gestión Académica y Administrativa Institucional",
              descripcion:
                "Facilitar, sistematizar y digitalizar los procesos inherentes al ciclo de vida educativo del estudiante, abarcando el control de asistencia regular, la trazabilidad del rendimiento escolar, la emisión de actas de evaluación y la gestión de permisos formales dentro de las dependencias del establecimiento educacional.",
            },
            {
              termino: "Coordinación y Trazabilidad de la Formación Técnico-Profesional (Dual)",
              descripcion:
                "Administrar de manera eficiente y segura la vinculación, derivación y asignación de los estudiantes a los respectivos Centros de Práctica o Empresas Colaboradoras. Esto incluye la comunicación bidireccional de expedientes estrictamente necesarios entre el Profesor Guía (entorno escolar) y el Maestro Guía (entorno laboral), con el objeto de supervisar el cumplimiento del currículum de formación dual.",
            },
            {
              termino: "Validación Documental y Gestión de Justificaciones Médicas",
              descripcion:
                "Procesar de forma transitoria y ultra-confidencial los certificados, licencias o documentos de carácter médico-sanitario adjuntados por los usuarios, con el único fin procedimental de validar inasistencias, aprobar ausencias justificadas o activar protocolos de adaptación curricular y/o laboral por motivos de salud acreditados.",
            },
            {
              termino: "Cumplimiento de Obligaciones de Auditoría, Fiscalización y Respaldo Legal",
              descripcion:
                "Conservar la trazabilidad de la información académica para dar respuesta oportuna, íntegra y veraz a los eventuales requerimientos de fiscalización, auditoría o solicitud de antecedentes emanados desde el Ministerio de Educación de Chile (MINEDUC), la Superintendencia de Educación, u otros órganos del Estado provistos de facultades fiscalizadoras competentes.",
            },
          ],
        },
      ],
    },
    {
      id: "4-2",
      numero: "4.2.",
      titulo: "Base de Licitud y Legitimación Jurídica del Tratamiento",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Todo tratamiento de datos personales ejecutado dentro del perímetro de la plataforma se sustenta en bases de licitud sólidas, reconocidas por el ordenamiento jurídico y que eximen a la operación de cualquier vicio de ilegalidad o arbitrariedad. Las bases de legitimación que facultan el funcionamiento de este ecosistema digital son:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Consentimiento Libre, Informado y Previo",
              descripcion:
                "Tratándose del ingreso a la plataforma, la base primordial es el consentimiento explícito del usuario (o el consentimiento prestado por representación legal a través de los padres y/o apoderados al momento de suscribir la matrícula y el contrato de prestación de servicios educativos). Este consentimiento se revalida técnicamente en la plataforma mediante la aceptación de la presente política en el primer inicio de sesión (log-in) y el uso de credenciales institucionales cerradas.",
            },
            {
              termino: "Ejecución de un Mandato Institucional y/o Relación Educativa",
              descripcion:
                "El tratamiento resulta indispensable y proporcional para la correcta ejecución del servicio educativo y formativo pactado entre el estudiante, su familia y la institución escolar. Sin el procesamiento de esta información, la administración del modelo de alternancia educativa (Formación Dual) resultaría material y logísticamente inviable.",
            },
            {
              termino: "Cumplimiento de una Obligación Legal (Deber de Retención)",
              descripcion:
                "Parte del tratamiento, especialmente el almacenamiento a largo plazo de las fichas y actas, encuentra su justificación jurídica en la obligación legal que recae sobre los establecimientos educacionales de preservar la historia académica de sus estudiantes según las normativas del Ministerio de Educación.",
            },
          ],
        },
      ],
    },
    {
      id: "4-3",
      numero: "4.3.",
      titulo: "Prohibición Absoluta de Comercialización, Lucro y Perfilamiento Publicitario",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Como garantía inalienable y pilar fundamental de la ética de la plataforma, el Responsable del Tratamiento establece una cláusula pétrea e inmodificable respecto al destino comercial de los activos de información:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Inmunidad Comercial (Zero-Monetization Policy)",
              descripcion:
                "Se prohíbe de manera absoluta, perpetua e incondicional la venta, arriendo, cesión onerosa o gratuita, permuta o cualquier forma de transferencia de las bases de datos a terceras partes, agencias de publicidad, brokers de datos o entidades comerciales, bajo ningún pretexto o justificación económica.",
            },
            {
              termino: "Ausencia de Perfilamiento Mercantil (No Profiling)",
              descripcion:
                "Los datos personales, académicos y especialmente los datos sensibles (salud), jamás serán sometidos a algoritmos de perfilamiento, inteligencia artificial predictiva orientada al consumo, ni a sistemas de análisis masivo (Big Data) con el fin de generar perfiles de consumidores, inferir comportamientos de mercado o emitir publicidad dirigida (pautas de marketing o retargeting).",
            },
            {
              termino: "Restricción de Cesión a Terceros",
              descripcion:
                "La información alojada en la plataforma solo fluye entre los actores estrictamente necesarios para el proceso educativo (Colegio - Alumno - Centro de Práctica). Cualquier otra cesión de datos a organismos externos solo procederá mediante orden judicial emanada de un tribunal competente de la República, o por requerimiento formal y fundamentado en la ley de un organismo público con facultades fiscalizadoras.",
            },
          ],
        },
      ],
    },
  ],
};
