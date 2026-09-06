import type { EstadoPlanComercial, PeriodicidadPlan } from "@/types";

/** Formatea un precio en pesos chilenos — sin conversión de moneda, la
 * única preparada por ahora (ver PlanComercial.moneda). */
export function formatearCLP(precio: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(precio);
}

export const ETIQUETA_PERIODICIDAD: Record<PeriodicidadPlan, string> = {
  mensual: "Mensual",
  semestral: "Semestral",
  anual: "Anual",
};

/** Sufijo mostrado junto al precio en cada tarjeta ("$XX.XXX / mes"). */
export const SUFIJO_PERIODICIDAD: Record<PeriodicidadPlan, string> = {
  mensual: "/ mes",
  semestral: "/ 6 meses",
  anual: "/ año",
};

export const DESCRIPCION_ACCESO: Record<PeriodicidadPlan, string> = {
  mensual: "Acceso a SIGEDUAL durante un mes.",
  semestral: "Acceso a SIGEDUAL durante seis meses.",
  anual: "Acceso a SIGEDUAL durante doce meses.",
};

export const ETIQUETA_ESTADO_PLAN: Record<EstadoPlanComercial, string> = {
  activo: "Activo",
  proximamente: "Próximamente",
  inactivo: "Inactivo",
  suspendido: "Suspendido",
};
