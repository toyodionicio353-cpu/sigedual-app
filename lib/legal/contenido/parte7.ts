import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_7: ParteLegal = {
  id: "parte-7",
  numero: 7,
  titulo: "INFRAESTRUCTURA TECNOLÓGICA, PROVEEDORES DE ALOJAMIENTO (VERCEL Y GITHUB), Y PROTOCOLOS DE CIFRADO",
  completo: true,
  secciones: [
    {
      id: "7-1",
      numero: "7.1.",
      titulo: "Arquitectura de Infraestructura en la Nube y Proveedores Tecnológicos",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Para garantizar la continuidad operacional, la disponibilidad permanente y los más altos estándares de resiliencia frente a fallos técnicos, la plataforma se encuentra desplegada sobre una arquitectura de cómputo en la nube moderna, distribuida y de alta seguridad. El procesamiento de datos y el almacenamiento de los repositorios de código fuente se sustentan de manera formal en los siguientes proveedores tecnológicos de categoría global:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Vercel Inc. (Infraestructura de Despliegue y Alojamiento Web)",
              descripcion:
                "Proveedor encargado de la ejecución de la interfaz de usuario, las funciones serverless y el direccionamiento del tráfico web (Edge Network). Vercel opera bajo rigurosos marcos de cumplimiento normativo internacional, garantizando la escalabilidad elástica y el aislamiento de entornos de ejecución para prevenir la interferencia de procesos externos.",
            },
            {
              termino: "GitHub Inc. (Control de Versiones y Gestión de Código Fuente)",
              descripcion:
                "Plataforma de repositorio donde se almacena de forma cifrada el código fuente del sistema. GitHub implementa estrictos controles de acceso mediante llaves criptográficas SSH, autenticación multifactor (MFA) obligatoria para el equipo de desarrollo, y registros de auditoría de modificaciones (commit logs), asegurando que cualquier cambio en la arquitectura del software se encuentre debidamente trazado.",
            },
          ],
        },
      ],
    },
    {
      id: "7-2",
      numero: "7.2.",
      titulo: "Protocolos Criptográficos de Seguridad en Tránsito y en Reposo",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "La confidencialidad e integridad de la información que fluye entre los terminales de los usuarios (dispositivos clientes) y los servidores de la plataforma se encuentra blindada mediante la aplicación sistemática de estándares criptográficos avanzados:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Cifrado en Tránsito (In-Transit Encryption)",
              descripcion:
                "Todo el tráfico de datos generado en la plataforma se encuentra permanentemente protegido bajo el protocolo HTTPS (Hypertext Transfer Protocol Secure), operando mediante la implementación estricta de certificados digitales SSL/TLS de alta robustez. Se fuerza el uso de las versiones más seguras y actualizadas del protocolo TLS (TLS 1.2 y TLS 1.3), lo que imposibilita de manera absoluta la interceptación, lectura o manipulación de la información por parte de terceros malintencionados en redes públicas o mediante ataques de intermediario (Man-in-the-Middle).",
            },
            {
              termino: "Cifrado en Reposo (At-Rest Encryption)",
              descripcion:
                "Los repositorios de bases de datos, archivos adjuntos institucionales, fichas académicas y justificativos médicos almacenados en la infraestructura de los proveedores de la plataforma se encuentran cifrados en los discos y servidores de almacenamiento mediante algoritmos de encriptación simétrica estándar de la industria (tales como AES-256), impidiendo el acceso a los datos físicos en caso de vulneración del hardware subyacente.",
            },
          ],
        },
      ],
    },
    {
      id: "7-3",
      numero: "7.3.",
      titulo: "Garantías de Disponibilidad, Resiliencia y Mitigación de Riesgos de Infraestructura",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "La arquitectura basada en servicios distribuidos de tipo Cloud Edge otorga a la plataforma una serie de ventajas técnicas en materia de seguridad defensiva:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Protección contra ataques de Denegación de Servicio (DDoS)",
              descripcion:
                "Los servidores de borde (Edge Servers) de la infraestructura disponen de mecanismos automáticos de mitigación de tráfico anómalo, absorbiendo y bloqueando solicitudes masivas maliciosas antes de que comprometan el núcleo de la base de datos de gestión académica.",
            },
            {
              termino: "Aislamiento de Entornos de Pruebas y Producción",
              descripcion:
                "El código y las bases de datos operan bajo estrictas políticas de separación lógica. Los cambios introducidos en el repositorio de GitHub pasan por procesos de revisión y compilación automatizada que evitan la introducción de vulnerabilidades críticas (bugs o brechas de inyección) en el entorno de producción real.",
            },
          ],
        },
      ],
    },
  ],
};
