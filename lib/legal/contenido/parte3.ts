import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_3: ParteLegal = {
  id: "parte-3",
  numero: 3,
  titulo: "TAXONOMÍA, TIPOLOGÍA Y CLASIFICACIÓN DE LOS DATOS PERSONALES Y SENSIBLES OBJETO DE TRATAMIENTO",
  completo: true,
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
            "La plataforma contempla la ingesta, almacenamiento y procesamiento transitorio de datos de salud única y exclusivamente bajo la figura de justificaciones médicas, certificados de salud, licencias o diagnósticos clínicos limitados, cuya finalidad exclusiva sea la validación administrativa de inasistencias, la aprobación de permisos especiales o la determinación de la aptitud física del estudiante para la ejecución de labores específicas dentro de su centro de práctica dual.",
        },
        {
          tipo: "parrafo",
          texto: "Para el tratamiento de estos datos de categoría especial, se imponen las siguientes directrices de resguardo máximo:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Acceso Hermético y Restringido",
              descripcion:
                "Los documentos que contengan datos de salud serán encriptados y su visualización estará restringida de manera granulada, siendo accesibles única y exclusivamente por el equipo directivo, el coordinador TP o el profesor guía directamente responsable de la tramitación administrativa del permiso o justificación.",
            },
            {
              termino: "Prohibición de Indexación y Perfilamiento",
              descripcion:
                "Queda determinantemente prohibida la utilización de diagnósticos médicos para la creación de perfiles predictivos, discriminación académica, o cualquier otro fin distinto a la justificación procedimental de ausencias o la adecuación del entorno de práctica por motivos de fuerza mayor de salud.",
            },
          ],
        },
      ],
    },
    {
      id: "3-3",
      numero: "3.3.",
      titulo: "Cláusula de Exclusión Expresa (Limitación Negativa del Tratamiento)",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Con el objeto de dotar de certeza jurídica a los titulares de los datos y delimitar de manera inequívoca las fronteras del tratamiento de la información, el Responsable del Tratamiento declara de forma categórica y expresa las tipologías de datos que NO son objeto de recopilación, procesamiento ni almacenamiento bajo ninguna circunstancia dentro de los servidores de la plataforma:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Exclusión de Datos de Naturaleza Financiera, Comercial o de Facturación",
              descripcion:
                "La plataforma carece de funcionalidades de comercio electrónico (e-commerce), por lo que no se solicita, procesa, ni almacena información relativa a tarjetas de crédito, tarjetas de débito, cuentas bancarias, historiales crediticios, direcciones de facturación tributaria, ni registros de transacciones monetarias o pagos de ninguna índole.",
            },
            {
              termino: "Exclusión de Datos de Geolocalización Continua y Direcciones Físicas Personales Arbitrarias",
              descripcion:
                "No se efectúa rastreo satelital (GPS), ni se recopilan coordenadas de ubicación en tiempo real de los dispositivos de los usuarios. Las ubicaciones registradas se limitan estrictamente a los domicilios institucionales de los centros de práctica dual para efectos de asignación del estudiante, excluyendo el monitoreo físico de la vida privada del menor.",
            },
            {
              termino: "Exclusión de Números Telefónicos de Uso Privado",
              descripcion:
                "A menos que exista un mandato institucional explícito para casos de emergencia vital, la plataforma prioriza la comunicación telemática vía correo institucional, desincentivando y excluyendo la captura sistemática de números de telefonía móvil personal o residencial ajenos al entorno educativo.",
            },
          ],
        },
      ],
    },
  ],
};
