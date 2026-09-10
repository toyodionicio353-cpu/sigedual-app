import { formatearHora } from "@/lib/fecha";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Fecha compacta para la bandeja: la hora si es de hoy, "Ayer" si es de
 * ayer, el día si es de esta semana, y día+mes más atrás. */
export function fechaBandeja(iso: string, formatoHora: "12" | "24" = "24"): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const ahora = new Date();
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diferenciaDias = Math.round((dia(ahora) - dia(fecha)) / 86_400_000);

  if (diferenciaDias === 0) return formatearHora(iso, formatoHora);
  if (diferenciaDias === 1) return "Ayer";
  if (diferenciaDias < 7) return DIAS[fecha.getDay()];
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
}

/** Fecha completa para la cabecera de cada mensaje dentro del hilo. */
export function fechaMensaje(iso: string, formatoHora: "12" | "24" = "24"): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]} · ${formatearHora(iso, formatoHora)}`;
}

/** Inicial para el avatar: una letra, la del nombre. */
export function inicial(nombre?: string): string {
  return (nombre?.trim().charAt(0) || "?").toUpperCase();
}

/** Color estable derivado del nombre, dentro de la paleta de SIGEDUAL, para
 * que cada persona tenga siempre el mismo avatar sin guardar nada. */
export function colorAvatar(nombre?: string): string {
  const paleta = ["var(--accent)", "var(--success)", "var(--accent-light)", "var(--warning)"];
  const texto = nombre?.trim() || "?";
  let suma = 0;
  for (let i = 0; i < texto.length; i += 1) suma += texto.charCodeAt(i);
  return paleta[suma % paleta.length];
}
