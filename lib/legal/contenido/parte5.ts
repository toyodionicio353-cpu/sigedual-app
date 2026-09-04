import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_5: ParteLegal = {
  id: "parte-5",
  numero: 5,
  titulo: "ARQUITECTURA DE SEGURIDAD INFORMÁTICA, MECANISMOS DE AUTENTICACIÓN RESTRINGIDA Y CONTROL DE ACCESO BASADO EN ROLES (RBAC)",
  completo: true,
  secciones: [
    {
      id: "5-1",
      numero: "5.1.",
      titulo: "Protocolos de Autenticación Institucional, Identidad Digital y Criptografía Transitoria",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Con el objetivo primordial de mitigar vectores de ataque, prevenir la suplantación de identidad (spoofing) y asegurar que el ingreso a la plataforma se encuentre circunscrito exclusivamente a la comunidad educativa formal, el Responsable del Tratamiento ha implementado una arquitectura de seguridad perimetral basada en el principio de confianza cero (Zero Trust). El proceso de alta, registro y autenticación (log-in) de los usuarios se rige por las siguientes exigencias técnicas e ineludibles:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Exclusividad de Dominio Institucional (Filtro de Red)",
              descripcion:
                "Queda estrictamente bloqueado a nivel de servidor el registro o creación de cuentas de usuario utilizando proveedores de correo electrónico de carácter público, genérico o comercial (tales como @gmail.com, @outlook.com, @yahoo.com, entre otros). La plataforma exige obligatoriamente, como llave de paso primigenia, la utilización de una dirección de correo electrónico provista por el establecimiento educacional, dotada de un dominio institucional homologado y validado (@dominio.cl). Toda petición proveniente de un dominio no listado en la base de datos de la institución será automáticamente rechazada por el sistema.",
            },
            {
              termino: "Emisión de Códigos Temporales de Verificación y Caducidad Lógica (TTL)",
              descripcion:
                "La mera posesión de un correo institucional no otorga derecho automático de acceso. Para la habilitación inicial de una cuenta, el usuario requiere de un código de autorización alfanumérico. Este vector de acceso solo puede ser generado y provisto de manera centralizada por el Director del establecimiento o por el Administrador del sistema.",
            },
            {
              termino: "Mecanismo de Expiración Estricta (Regla de las 23:59 horas)",
              descripcion:
                "Para prevenir la vulnerabilidad derivada de la acumulación de códigos inactivos y el robo de credenciales en tránsito, los códigos temporales de acceso están sujetos a un ciclo de vida útil (Time-To-Live - TTL) de carácter efímero y perecedero. Todo código generado caducará, perderá su validez criptográfica y será destruido lógicamente en la base de datos a las 23:59 horas del mismo día de su emisión. Transcurrido dicho umbral temporal, el código resultará informáticamente inútil, debiendo el usuario solicitar una nueva credencial de habilitación.",
            },
          ],
        },
      ],
    },
    {
      id: "5-2",
      numero: "5.2.",
      titulo: "Matriz de Control de Acceso Basado en Roles (RBAC) y Segmentación Hermética de Privilegios",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En cumplimiento del Principio de Mínimo Privilegio (PoLP - Principle of Least Privilege) y el mandato de confidencialidad estipulado en el artículo 7° de la Ley N° 19.628, la plataforma cuenta con una arquitectura de bases de datos relacionales diseñada para impedir la escalada de privilegios (tanto vertical como horizontal). La visualización, edición y extracción de la información se encuentra segmentada, parcelada y delimitada de manera hermética a través de una matriz de Control de Acceso Basado en Roles (Role-Based Access Control - RBAC):",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Rol de Administrador / Desarrollador (Nivel 0 - Infraestructura)",
              descripcion:
                "Ostentado por el titular de la plataforma. Posee facultades exclusivas de mantenimiento técnico, auditoría de código, corrección de anomalías (debugging), gestión de la infraestructura en la nube y configuración de las bases de datos. Su acceso a datos personales directos está limitado a funciones de soporte técnico y resolución de incidencias, operando bajo un deber de secreto absoluto.",
            },
            {
              termino: "Rol de Director y Coordinador TP (Nivel 1 - Gestión Institucional)",
              descripcion:
                "Ostenta facultades de administración global dentro de los límites lógicos de su respectivo establecimiento. Tienen autorización técnica para visualizar la totalidad de los expedientes académicos de su matrícula, asignar tutores, emitir códigos de registro y supervisar la trazabilidad general del proceso de Formación Dual, actuando como garantes institucionales de la información.",
            },
            {
              termino: "Rol de Profesor Guía (Nivel 2 - Supervisión de Cohorte)",
              descripcion:
                "El acceso de este perfil se encuentra lógicamente restringido mediante llaves foráneas (foreign keys) a los expedientes, asistencias y justificaciones médicas de los estudiantes que le han sido explícita y formalmente asignados bajo su tutoría. Carecen de permisos para visualizar registros de alumnos de otras cohortes, niveles o profesores.",
            },
            {
              termino: "Rol de Maestro Guía / Centro Dual (Nivel 3 - Tutoría Externa Limitada)",
              descripcion:
                "Las personas externas a la institución educativa que actúan como supervisores en los centros de práctica poseen un perfil de acceso extremadamente restrictivo (sandbox). Únicamente están facultados para visualizar la información de identidad y asistencia del alumno en específico que se encuentra materialmente asignado a su centro para el desarrollo de la práctica, bloqueándose por sistema cualquier acceso al resto del padrón estudiantil.",
            },
            {
              termino: "Rol de Alumno (Nivel 4 - Titular Individual)",
              descripcion:
                "Los estudiantes poseen un perfil de lectura y carga bidireccional estrictamente confinado. El sistema impone un aislamiento total (silamiento de datos) que garantiza que el alumno solo puede visualizar, editar y gestionar su propia información, sus propios documentos y su propio historial de rendimiento. La arquitectura imposibilita técnicamente el movimiento lateral que permitiría a un alumno acceder a la base de datos o expedientes de sus pares.",
            },
          ],
        },
      ],
    },
    {
      id: "5-3",
      numero: "5.3.",
      titulo: "Medidas Técnicas de Resguardo Lógico y Prevención de Fugas de Información (Data Leak Prevention)",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Complementando el esquema de roles y autenticación, el servidor implementa la denegación implícita de acceso por defecto (default-deny). Todas las rutas (endpoints), interfaces de programación de aplicaciones (APIs) y consultas a la base de datos requieren el envío y validación continua de un token de sesión activo e inviolable en cada petición HTTP. Cualquier intento de inyección de código, manipulación de URL o alteración de los parámetros de solicitud para acceder a directorios ajenos al rol asignado, resultará en la terminación abrupta de la sesión (expulsión del usuario) y el registro inmediato de la anomalía en la bitácora de seguridad (Log de auditoría).",
        },
      ],
    },
  ],
};
