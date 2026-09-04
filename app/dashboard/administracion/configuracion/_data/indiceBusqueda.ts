export type CategoriaConfig = "apariencia" | "interaccion" | "idioma" | "notificaciones" | "privacidad";

export interface EntradaBusqueda {
  id: string; // debe coincidir con el id= del SettingRow correspondiente
  categoria: CategoriaConfig;
  titulo: string;
  descripcion: string;
  keywords: string[];
}

export const INDICE_BUSQUEDA: EntradaBusqueda[] = [
  { id: "set-tema", categoria: "apariencia", titulo: "Tema de la interfaz", descripcion: "Claro, oscuro o según el sistema.", keywords: ["oscuro", "claro", "modo oscuro", "modo claro", "tema", "sistema"] },
  { id: "set-acento", categoria: "apariencia", titulo: "Color de acento", descripcion: "Color de botones, enlaces y elementos activos.", keywords: ["color", "acento", "amarillo", "marca"] },
  { id: "set-densidad", categoria: "apariencia", titulo: "Densidad de interfaz", descripcion: "Cómoda o compacta.", keywords: ["densidad", "espaciado", "compacta", "cómoda", "tablas"] },
  { id: "set-contraste", categoria: "apariencia", titulo: "Alto contraste", descripcion: "Mejora el contraste de textos y controles.", keywords: ["contraste", "accesibilidad", "visibilidad"] },
  { id: "set-fuente", categoria: "apariencia", titulo: "Tamaño de fuente", descripcion: "Pequeño, mediano, grande o muy grande.", keywords: ["fuente", "texto", "tamaño", "letra", "zoom"] },
  { id: "set-ancho", categoria: "apariencia", titulo: "Ancho del contenido", descripcion: "Ancho fijo o pantalla completa.", keywords: ["ancho", "layout", "pantalla completa"] },
  { id: "set-sonidos", categoria: "interaccion", titulo: "Efectos de sonido", descripcion: "Sonidos breves para confirmaciones y errores.", keywords: ["sonido", "audio", "efectos"] },
  { id: "set-haptica", categoria: "interaccion", titulo: "Respuesta háptica", descripcion: "Vibración breve en dispositivos compatibles.", keywords: ["vibración", "háptica", "táctil"] },
  { id: "set-paleta", categoria: "interaccion", titulo: "Paleta de comandos", descripcion: "Acceso rápido con Ctrl/Cmd + K.", keywords: ["paleta", "comandos", "buscar", "ctrl k", "cmd k"] },
  { id: "set-atajos", categoria: "interaccion", titulo: "Atajos de teclado", descripcion: "Navegación rápida mediante el teclado.", keywords: ["atajos", "teclado", "shortcuts"] },
  { id: "set-dashboard", categoria: "interaccion", titulo: "Personalizar Dashboard", descripcion: "Reordena, oculta y fija módulos del panel principal.", keywords: ["dashboard", "personalizar", "panel", "módulos"] },
  { id: "set-idioma", categoria: "idioma", titulo: "Idioma", descripcion: "Español o inglés.", keywords: ["idioma", "español", "inglés", "language"] },
  { id: "set-hora", categoria: "idioma", titulo: "Formato de fecha y hora", descripcion: "12 horas o 24 horas.", keywords: ["hora", "formato", "12 horas", "24 horas"] },
  { id: "set-zona", categoria: "idioma", titulo: "Zona horaria", descripcion: "Del dispositivo o manual.", keywords: ["zona horaria", "timezone", "santiago"] },
  { id: "set-push", categoria: "notificaciones", titulo: "Notificaciones push", descripcion: "Avisos del sistema en el navegador.", keywords: ["push", "notificaciones", "permiso", "navegador"] },
  { id: "set-categorias", categoria: "notificaciones", titulo: "Notificaciones dentro de SIGEDUAL", descripcion: "Mensajes, evaluaciones, visitas, documentos y más.", keywords: ["mensajes", "evaluaciones", "visitas", "bitácoras", "documentos", "asignaciones", "alertas"] },
  { id: "set-nomolestar", categoria: "notificaciones", titulo: "No molestar", descripcion: "Silencia notificaciones no críticas en un horario.", keywords: ["no molestar", "silencio", "horario"] },
  { id: "set-resumen", categoria: "notificaciones", titulo: "Frecuencia de resúmenes por email", descripcion: "Desactivado, diario o semanal.", keywords: ["correo", "email", "resumen", "resúmenes"] },
  { id: "set-cookies", categoria: "privacidad", titulo: "Preferencias de cookies", descripcion: "Cookies técnicas, de análisis y publicidad.", keywords: ["cookies", "rastreo", "análisis"] },
  { id: "set-legal", categoria: "privacidad", titulo: "Información legal", descripcion: "Política de privacidad, términos y aviso legal.", keywords: ["legal", "términos", "condiciones", "política de privacidad", "aviso legal"] },
  { id: "set-eliminar-cuenta", categoria: "privacidad", titulo: "Eliminar mi cuenta y mis datos", descripcion: "Derecho al olvido.", keywords: ["eliminar cuenta", "derecho al olvido", "borrar datos"] },
  { id: "set-borradores", categoria: "privacidad", titulo: "Guardar borradores automáticamente", descripcion: "Evita perder información en formularios.", keywords: ["borrador", "borradores", "autoguardado"] },
  { id: "set-limpiar-cache", categoria: "privacidad", titulo: "Limpiar datos locales", descripcion: "Borra preferencias y borradores guardados en este dispositivo.", keywords: ["caché", "cache", "limpiar", "datos locales"] },
];
