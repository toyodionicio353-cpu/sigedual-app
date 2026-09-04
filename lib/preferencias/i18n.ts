import type { Idioma } from "@/types/preferencias";

// Diccionario de la interfaz (menús, botones, etiquetas y mensajes del
// sistema) — NUNCA de datos introducidos por usuarios (nombres, direcciones,
// contenido de documentos, etc., que no deben traducirse).
//
// Arquitectura preparada para más idiomas: agregar una clave más a
// `Idioma` en types/preferencias.ts y una columna más aquí.
//
// Cobertura actual: la navegación (Sidebar, encabezado) y la página de
// Configuración. Traducir el resto de las ~60 páginas de SIGEDUAL es un
// trabajo aparte, deliberadamente fuera de este cambio: se agrega igual,
// una clave a la vez, sin tocar esta arquitectura.
export const DICCIONARIO = {
  es: {
    "nav.inicio": "Inicio",
    "nav.estudiantes": "Estudiantes",
    "nav.centros": "Centros Duales",
    "nav.profesores": "Profesores",
    "nav.especialidades": "Especialidades",
    "nav.documentos": "Documentos",
    "nav.mensajes": "Mensajes",
    "nav.administracion": "Administración",
    "nav.soporte": "Soporte",
    "nav.cerrarSesion": "Cerrar sesión",
    "nav.usuarios": "Usuarios",
    "nav.liceos": "Liceos",
    "nav.datosLiceo": "Datos del liceo",
    "nav.seguridad": "Seguridad",
    "nav.usuario": "Usuario",
    "nav.configuracion": "Configuración",
    "nav.privacidad": "Políticas de privacidad",
    "config.titulo": "Configuración",
    "config.subtitulo": "Centro de preferencias del sistema. Personaliza tu experiencia en SIGEDUAL sin afectar los datos académicos ni la configuración de otros usuarios.",
    "config.buscar": "Buscar configuración...",
    "config.sinResultados": "No se encontraron configuraciones para tu búsqueda.",
    "config.cat.apariencia": "Apariencia",
    "config.cat.interaccion": "Interacción",
    "config.cat.idioma": "Idioma y región",
    "config.cat.notificaciones": "Notificaciones",
    "config.cat.privacidad": "Privacidad y datos",
    "config.restablecer": "Restablecer configuración",
    "config.guardado": "Preferencia guardada.",
  },
  en: {
    "nav.inicio": "Home",
    "nav.estudiantes": "Students",
    "nav.centros": "Dual Centers",
    "nav.profesores": "Teachers",
    "nav.especialidades": "Specialties",
    "nav.documentos": "Documents",
    "nav.mensajes": "Messages",
    "nav.administracion": "Administration",
    "nav.soporte": "Support",
    "nav.cerrarSesion": "Log out",
    "nav.usuarios": "Users",
    "nav.liceos": "Schools",
    "nav.datosLiceo": "School data",
    "nav.seguridad": "Security",
    "nav.usuario": "Account",
    "nav.configuracion": "Settings",
    "nav.privacidad": "Privacy policy",
    "config.titulo": "Settings",
    "config.subtitulo": "System preferences center. Personalize your SIGEDUAL experience without affecting academic data or other users' settings.",
    "config.buscar": "Search settings...",
    "config.sinResultados": "No settings matched your search.",
    "config.cat.apariencia": "Appearance",
    "config.cat.interaccion": "Interaction",
    "config.cat.idioma": "Language & region",
    "config.cat.notificaciones": "Notifications",
    "config.cat.privacidad": "Privacy & data",
    "config.restablecer": "Reset settings",
    "config.guardado": "Preference saved.",
  },
} as const;

export type ClaveTraduccion = keyof (typeof DICCIONARIO)["es"];

export function traducir(idioma: Idioma, clave: ClaveTraduccion): string {
  return DICCIONARIO[idioma]?.[clave] ?? DICCIONARIO.es[clave] ?? clave;
}
