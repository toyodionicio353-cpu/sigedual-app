import type { PlantillaDocumento } from "@/types/plantillas";
import { estudianteTieneCentroDualAsignado } from "./resolverCampos";

/**
 * Plantillas de Convenios. Vacío a propósito: el contenido real (texto,
 * partes protegidas y campos automáticos) lo entrega el usuario y se
 * agrega acá como una entrada nueva, sin tocar el resto del sistema.
 */
export const PLANTILLAS_CONVENIOS: PlantillaDocumento[] = [];

/** Regla de elegibilidad por defecto para plantillas de Convenios: el estudiante debe tener un centro dual asignado. */
export const elegibilidadConvenio: PlantillaDocumento["elegibilidad"] = (ctx, estudiante) =>
  estudianteTieneCentroDualAsignado(estudiante.id, ctx);
