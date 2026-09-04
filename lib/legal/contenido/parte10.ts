import type { ParteLegal } from "../tipos";

// Contenido jurídico cerrado — transcrito literalmente del texto entregado.
// No resumir, no corregir, no reescribir. Ver lib/legal/tipos.ts.
export const PARTE_10: ParteLegal = {
  id: "parte-10",
  numero: 10,
  titulo: "POLÍTICA DE COOKIES, TECNOLOGÍAS DE RASTREO Y AUSENCIA DE RASTREADORES PUBLICITARIOS INVASIVOS",
  completo: true,
  secciones: [
    {
      id: "10-1",
      numero: "10.1.",
      titulo: "Naturaleza y Tipología de las Cookies Utilizadas (Estrictamente Necesarias y de Sesión)",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "En estricta observancia de los principios de transparencia, minimización y proporcionalidad en el tratamiento de datos informáticos, la plataforma web de gestión académica y formación dual limita de manera radical y restrictiva el uso de tecnologías de almacenamiento local y trazabilidad en los dispositivos de los usuarios (comúnmente denominadas cookies o tecnologías análogas).",
        },
        {
          tipo: "parrafo",
          texto:
            "El sistema no utiliza cookies de seguimiento publicitario, píxeles de conversión de redes sociales, rastreadores comerciales de terceros, ni herramientas de monetización de navegación. Las únicas tecnologías de almacenamiento local empleadas por la plataforma se clasifican estrictamente bajo la categoría de Cookies Técnicas, Esenciales y de Sesión, las cuales se detallan a continuación:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Cookies de Autenticación y Mantenimiento de Sesión",
              descripcion:
                "Son ficheros de datos temporales imprescindibles para que el servidor reconozca que el usuario ya se ha autenticado legítimamente mediante su cuenta de correo institucional (@dominio.cl) y su código temporal de verificación. Su única finalidad técnica es mantener la sesión activa de forma segura mientras el usuario interactúa con los módulos de su rol correspondiente, impidiendo la desconexión abrupta o la pérdida de integridad en el envío de formularios académicos.",
            },
            {
              termino: "Cookies de Seguridad Perimetral y Prevención de Fraude (Anti-CSRF y Tokens de Integridad)",
              descripcion:
                "Dispositivos lógicos destinados a proteger la arquitectura web frente a ataques de falsificación de peticiones en sitios cruzados (Cross-Site Request Forgery) y otras vulnerabilidades informáticas. Estas cookies operan de manera totalmente aislada y transparente, sin recolectar ningún tipo de información de navegación ajena al estricto funcionamiento técnico de la plataforma.",
            },
          ],
        },
      ],
    },
    {
      id: "10-2",
      numero: "10.2.",
      titulo: "Inexistencia Absoluta de Rastreadores Publicitarios Invasivos y Perfilamiento Comercial",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Como derivación directa de la política institucional de cero marketing y absoluta inmunidad comercial de los datos de los estudiantes de enseñanza media, se declara formalmente lo siguiente:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Ausencia de Trackers de Publicidad Comportamental",
              descripcion:
                "La plataforma carece de scripts, etiquetas o SDKs (Software Development Kits) vinculados a redes publicitarias globales, motores de búsqueda comerciales o redes sociales orientadas al monitoreo de la conducta de navegación de los usuarios (behavioral tracking).",
            },
            {
              termino: "Bloqueo de Analíticas Invasivas No Autorizadas",
              descripcion:
                "No se recopilan huellas digitales de dispositivos (browser fingerprinting), ni se ceden metadatos de navegación a intermediarios tecnológicos con fines estadísticos comerciales. Cualquier métrica de rendimiento web se procesa de manera interna, anónima y agregada, impidiendo la identificación individual de los estudiantes o docentes.",
            },
          ],
        },
      ],
    },
    {
      id: "10-3",
      numero: "10.3.",
      titulo: "Banner de Transparencia y Consentimiento Voluntario",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            "Al momento de acceder por primera vez a la interfaz web de la plataforma, el sistema despliega un Banner de Información y Consentimiento de Cookies Técnicas, el cual informa de manera clara, accesible y directa al usuario sobre la naturaleza estrictamente operacional de los ficheros informáticos utilizados:",
        },
        {
          tipo: "lista_definiciones",
          items: [
            {
              termino: "Inexistencia de Aceptación Forzosa de Cookies Comerciales",
              descripcion:
                "Dado que la plataforma no instala cookies de análisis comercial ni publicitarias, no se requiere la aceptación de consentimientos complejos o casillas de marcado múltiple para fines de marketing.",
            },
            {
              termino: "Aceptación Implícita por Uso Operativo",
              descripcion:
                "El uso de las cookies estrictamente necesarias se entiende consentido por el hecho mismo de utilizar la plataforma y autenticarse con el correo institucional para el cumplimiento de las finalidades académicas y de formación dual. El usuario conserva en todo momento la facultad técnica de deshabilitar las cookies directamente desde la configuración de seguridad de su navegador web, bajo el entendido de que dicha acción inhabilitará automáticamente el acceso a la plataforma al interrumpir el token de sesión indispensable.",
            },
          ],
        },
      ],
    },
  ],
};
