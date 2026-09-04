import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_6: ParteLegal = {
  id: "parte-6",
  numero: 6,
  titulo: "RÉGIMEN DE RESPONSABILIDAD DIRECTA DEL USUARIO, DEBER DE CUSTODIA DE CREDENCIALES Y TRAZABILIDAD MEDIANTE REGISTROS DE AUDITORÍA (AUDIT LOGS)",
  completo: true,
  secciones: [
    {
      id: "6-1",
      numero: "6.1.",
      titulo: "Atribución de Responsabilidad Subjetiva frente a Negligencias, Dolo y Abuso de Facultades",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Sin perjuicio de la responsabilidad general que recae sobre el Responsable del Tratamiento y titular de la plataforma en lo tocante a la seguridad perimetral de la infraestructura tecnológica, la integridad y el resguardo de los datos personales y sensibles almacenados se sustentan de manera co-responsable en la actuación diligente, ética y legal de cada uno de los usuarios que detentan privilegios de acceso al sistema (personal directivo, coordinadores, profesores guías, maestros guías de centros duales y alumnos).",
        },
        {
          tipo: "parrafo",
          texto:
            "En consecuencia, el ordenamiento interno de la plataforma establece que el usuario asume la responsabilidad civil, administrativa y, de ser procedente, penal derivada de cualquier filtración, exposición, uso indebido o daño a la información confidencial que sea imputable directa o indirectamente a su propia negligencia, impericia, dolo o abuso deliberado de las facultades inherentes a su rol asignado. Se tipifican como conductas generadoras de responsabilidad exclusiva del usuario las siguientes:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Ceder, Prestar o Compartir Credenciales de Acceso",
              descripcion:
                "La transferencia voluntaria o el descuido manifiesto del usuario respecto a su contraseña, sus datos de usuario institucional o los códigos temporales de verificación a terceras personas ajenas o no autorizadas.",
            },
            {
              termino: "Exposición u Omisión de Cierre de Sesión (Session Hijacking Prevention)",
              descripcion:
                "Abandonar terminales informáticas, dispositivos móviles o equipos de computación con una sesión activa de la plataforma sin la debida supervisión, permitiendo el acceso físico de terceros no autorizados a los expedientes académicos o fichas de salud.",
            },
            {
              termino: "Extracción y Manipulación No Autorizada de Datos",
              descripcion:
                "La captura de pantallas (screenshots), descarga masiva de información confidencial, fotografía de expedientes o la difusión de datos académicos y sensibles fuera de los estrictos canales, dispositivos y fines institucionales previstos por el sistema.",
            },
            {
              termino: "Falsificación, Adulteración o Inserción Maliciosa de Documentos",
              descripcion:
                "El envío intencionado de certificados de salud falsificados, licencias médicas adulteradas, permisos alterados o datos personales fraudulentos con el propósito de burlar los controles administrativos de asistencia o justificación escolar.",
            },
          ],
        },
      ],
    },
    {
      id: "6-2",
      numero: "6.2.",
      titulo: "Deber Exigible de Custodia de Credenciales y el Bloqueo de Acceso Multidispositivo",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Todo usuario registrado en la plataforma asume el estricto deber de diligencia en la custodia de su identidad digital institucional. El uso de las cuentas de correo @dominio.cl y las contraseñas personales es de naturaleza estrictamente personal e intransferible.",
        },
        {
          tipo: "parrafo",
          texto:
            "La plataforma prohíbe el uso compartido de cuentas (multi-user account sharing). Ante cualquier sospecha fundada de vulneración, hurto, pérdida o acceso no autorizado a sus credenciales de autenticación, el usuario se encuentra en la obligación legal e institucional de notificar de manera inmediata al Responsable del Tratamiento a través del canal oficial (dionicio.toyo.gutierrez@gmail.com), con el objeto de proceder al bloqueo preventivo y reseteo del token de acceso, mitigando la propagación de una eventual brecha de seguridad.",
        },
      ],
    },
    {
      id: "6-3",
      numero: "6.3.",
      titulo: "Responsabilidad Específica en la Carga de Datos Sensibles (Salud) y Cláusula de Declaración Jurada",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Tratándose de los perfiles autorizados para la inserción de antecedentes médicos, licencias o certificados de salud (datos sensibles), la plataforma exige la aceptación de una Cláusula de Declaración Jurada Digital previa a la materialización de cualquier carga de archivos.",
        },
        {
          tipo: "parrafo",
          texto: "El usuario que sube un documento de naturaleza clínica declara formalmente, bajo su propia y exclusiva responsabilidad:",
        },
        {
          tipo: "lista",
          items: [
            "Que cuenta con las facultades legales, la representación o la autorización expresa conferida para el tratamiento de dichos datos de salud.",
            "Que la información y los archivos aportados son fidedignos, veraces y corresponden fielmente al documento original emitido por la autoridad sanitaria o profesional competente.",
            "Que asume el compromiso inquebrantable de mantener el secreto y la estricta confidencialidad de la información médica a la que accede en virtud de su rol.",
          ],
        },
      ],
    },
    {
      id: "6-4",
      numero: "6.4.",
      titulo: "Trazabilidad Digital y Sistema Automatizado de Registros de Auditoría (Audit Logs)",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Para garantizar la rendición de cuentas (accountability) y permitir la delimitación fehaciente de responsabilidades ante cualquier incidente de seguridad, brecha de datos o filtración de información confidencial, la plataforma cuenta con un subsistema automatizado e inmutable de Registros de Auditoría (Audit Logs).",
        },
        {
          tipo: "parrafo",
          texto:
            "El sistema registra de manera persistente, cronológica y automatizada un rastro digital (forensic footprint) de cada interacción efectuada dentro del entorno web, almacenando de forma indisoluble los siguientes parámetros técnicos:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Identificador de Usuario (User ID y Rol)",
              descripcion: "El registro exacto de qué perfil, cuenta y persona ejecutó la acción en el sistema.",
            },
            {
              termino: "Marca de Tiempo (Timestamp)",
              descripcion: "Fecha y hora exacta (sincronizada en formato UTC y hora local de Chile) de la solicitud.",
            },
            {
              termino: "Dirección IP y Metadatos de Red",
              descripcion: "El origen de red desde donde se emitió la petición HTTP y el agente de usuario (User-Agent) del navegador o dispositivo cliente.",
            },
            {
              termino: "Operación Transaccional Ejecutada",
              descripcion:
                "El evento informático específico (ej. autenticación exitosa, visualización de expediente, descarga de documento, modificación de registro de asistencia o subida de archivo sensible).",
            },
          ],
        },
        {
          tipo: "parrafo",
          texto:
            "Ante una eventual auditoría de seguridad, requerimiento de la Agencia de Protección de Datos Personales, o investigación de filtraciones, los Audit Logs constituirán la prueba técnica irrefutable para determinar si una brecha de seguridad provino de una vulnerabilidad sistémica de la infraestructura o de una negligencia o conducta dolosa atribuible a la acción u omisión de un usuario individual.",
        },
      ],
    },
  ],
};
