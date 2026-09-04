// Preferencias personales del usuario en SIGEDUAL — Centro de Preferencias del Sistema.
// Nunca contiene datos académicos, institucionales ni de otros usuarios: solo
// personalización de la experiencia individual en este dispositivo/cuenta.

export type TemaPreferencia = "claro" | "oscuro" | "sistema";
export type Densidad = "comoda" | "compacta";
export type TamanoFuente = "pequeno" | "mediano" | "grande" | "muy-grande";
export type AnchoContenido = "fijo" | "completo";
export type Idioma = "es" | "en";
export type FormatoHora = "12" | "24";
export type ZonaHorariaModo = "dispositivo" | "manual";
export type FrecuenciaResumenEmail = "desactivado" | "diario" | "semanal";
export type AcentoId = "amarillo" | "ambar" | "dorado" | "mostaza";

export interface NotificacionesCategorias {
  mensajes: boolean;
  comentarios: boolean;
  evaluaciones: boolean;
  visitas: boolean;
  bitacoras: boolean;
  documentos: boolean;
  asignaciones: boolean;
  alertasAdministrativas: boolean;
}

export interface PreferenciaNoMolestar {
  activo: boolean;
  inicio: string; // "HH:mm"
  fin: string; // "HH:mm"
}

export interface PreferenciaCookies {
  tecnicas: true; // siempre activas, no configurable
  analisis: boolean;
  publicidad: boolean;
}

export interface DashboardModuloPref {
  id: string;
  visible: boolean;
  fijado: boolean;
}

export interface Preferencias {
  version: 1;
  // Apariencia y visualización
  tema: TemaPreferencia;
  colorAcento: AcentoId;
  densidad: Densidad;
  altoContraste: boolean;
  tamanoFuente: TamanoFuente;
  anchoContenido: AnchoContenido;
  // Audio, interacción y atajos
  sonidos: boolean;
  haptica: boolean;
  paletaComandos: boolean;
  atajosTeclado: boolean;
  dashboardModulos: DashboardModuloPref[]; // [] = usar orden/visibilidad predeterminada
  // Idioma y regionalización
  idioma: Idioma;
  formatoHora: FormatoHora;
  zonaHorariaModo: ZonaHorariaModo;
  zonaHorariaManual: string;
  // Notificaciones y alertas
  notificacionesPush: boolean;
  notificacionesCategorias: NotificacionesCategorias;
  noMolestar: PreferenciaNoMolestar;
  resumenEmail: FrecuenciaResumenEmail;
  // Privacidad, legal y datos
  cookies: PreferenciaCookies;
  borradoresAutomaticos: boolean;
}
