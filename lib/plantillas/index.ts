import type { TipoModuloDocumento } from "@/types";
import type { PlantillaDocumento } from "@/types/plantillas";
import { PLANTILLAS_CONVENIOS } from "./convenios";
import { PLANTILLAS_DOCUMENTOS } from "./documentos";

const REGISTROS: Record<TipoModuloDocumento, PlantillaDocumento[]> = {
  convenio: PLANTILLAS_CONVENIOS,
  documento: PLANTILLAS_DOCUMENTOS,
};

/** Las páginas de cada módulo nunca importan los registros directamente — siempre pasan por acá. */
export function plantillasParaModulo(tipo: TipoModuloDocumento): PlantillaDocumento[] {
  return REGISTROS[tipo];
}

export const NOMBRE_MODULO: Record<TipoModuloDocumento, string> = {
  convenio: "Convenio",
  documento: "Documento",
};
