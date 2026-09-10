import type { EstadoPinCentro, EstadoPinPractica } from "./estados";
import type { PinCentro, PinMapa, PinPractica } from "./useDatosMapa";

/** Qué tipo de actividad se está mirando. */
export type TipoActividad = "todas" | "dual" | "practicas";

export interface FiltrosMapa {
  tipo: TipoActividad;
  estadosCentro: EstadoPinCentro[];
  estadosPractica: EstadoPinPractica[];
  /** Solo Centros Duales dentro de sus primeros 60 días. El período de
   * prueba no es un estado (no reemplaza el color), por eso va aparte. */
  soloPeriodoPrueba: boolean;
  texto: string;
}

export const ESTADOS_CENTRO: EstadoPinCentro[] = ["disponible", "asignado", "atencion", "inactivo", "critico"];
export const ESTADOS_PRACTICA: EstadoPinPractica[] = ["activa", "por_finalizar", "atencion", "finalizada"];

/**
 * Arranque: todo lo vigente. Las prácticas ya finalizadas quedan fuera
 * porque son historial — quien las quiera ver las enciende, y así el mapa
 * no abre lleno de puntos que ya no representan actividad en curso.
 */
export const FILTROS_INICIALES: FiltrosMapa = {
  tipo: "todas",
  estadosCentro: [...ESTADOS_CENTRO],
  estadosPractica: ["activa", "por_finalizar", "atencion"],
  soloPeriodoPrueba: false,
  texto: "",
};

export function hayFiltrosActivos(f: FiltrosMapa): boolean {
  return (
    f.tipo !== FILTROS_INICIALES.tipo
    || f.soloPeriodoPrueba
    || f.estadosCentro.length !== FILTROS_INICIALES.estadosCentro.length
    || f.estadosPractica.length !== FILTROS_INICIALES.estadosPractica.length
  );
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Texto sobre el que busca el buscador global. Incluye el nombre del
 * estudiante porque el punto 10 pide poder llegar a un lugar buscando a la
 * persona, no solo la empresa.
 */
function textoBuscable(pin: PinMapa): string {
  if (pin.tipo === "centro") {
    const c = pin.centro;
    return normalizar([
      c.nombre, c.razonSocial, c.nombreComercial, c.rut, c.id,
      c.direccion, c.comuna, c.ciudad, c.region,
      ...pin.estudiantes.map((e) => e.nombre),
    ].filter(Boolean).join(" "));
  }
  const p = pin.practica;
  return normalizar([
    p.lugarNombre, p.lugarRut, p.id, p.direccion, p.comuna, p.region,
    pin.estudiante?.nombre,
  ].filter(Boolean).join(" "));
}

export function coincideTexto(pin: PinMapa, texto: string): boolean {
  const q = normalizar(texto.trim());
  if (!q) return true;
  return textoBuscable(pin).includes(q);
}

export function filtrarCentros(centros: PinCentro[], f: FiltrosMapa): PinCentro[] {
  if (f.tipo === "practicas") return [];
  return centros.filter((c) => {
    if (!f.estadosCentro.includes(c.estado)) return false;
    if (f.soloPeriodoPrueba && !c.esNuevo) return false;
    return coincideTexto(c, f.texto);
  });
}

export function filtrarPracticas(practicas: PinPractica[], f: FiltrosMapa): PinPractica[] {
  if (f.tipo === "dual") return [];
  return practicas.filter((p) => f.estadosPractica.includes(p.estado) && coincideTexto(p, f.texto));
}

/** Alterna un valor dentro de una lista de filtros. */
export function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}
