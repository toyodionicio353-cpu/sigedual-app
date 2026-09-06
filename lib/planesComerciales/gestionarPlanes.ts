import { collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import { CARACTERISTICAS_DOC_ID } from "./useCaracteristicasComerciales";
import type { EstadoPlanComercial, PeriodicidadPlan, PlanComercial } from "@/types";

export interface DatosPlanFormulario {
  nombre: string;
  periodicidad: PeriodicidadPlan;
  precio: number;
  descripcion: string;
  estado: EstadoPlanComercial;
  recomendado: boolean;
  orden: number;
  textoDestacado?: string;
  informacionAdicional?: string;
}

/** Crea un plan comercial nuevo. Los precios/características quedan
 * registrados en auditoría porque son información comercial de SIGEDUAL. */
export async function crearPlan(datos: DatosPlanFormulario, adminUid: string, adminNombre: string): Promise<string> {
  const ahora = new Date().toISOString();
  const ref = doc(collection(db, "planes_comerciales"));
  const plan: Omit<PlanComercial, "id"> = {
    ...datos, moneda: "CLP", actualizadoEn: ahora, actualizadoPor: adminUid,
  };
  await setDoc(ref, plan);
  await registrarEvento({
    uid: adminUid, nombre: adminNombre, rol: "administrador", liceoId: "plataforma",
    accion: "plan_comercial.crear", recurso: "planes_comerciales", recursoId: ref.id, resultado: "permitido",
    detalle: `Plan "${datos.nombre}" (${datos.periodicidad}) creado con precio ${datos.precio} y estado ${datos.estado}.`,
  });
  return ref.id;
}

/** Actualiza un plan existente, registrando precio/estado anterior y nuevo. */
export async function actualizarPlan(
  planId: string, datos: DatosPlanFormulario, adminUid: string, adminNombre: string
): Promise<void> {
  const ref = doc(db, "planes_comerciales", planId);
  const snapAnterior = await getDoc(ref);
  const anterior = snapAnterior.exists() ? (snapAnterior.data() as PlanComercial) : undefined;

  await updateDoc(ref, { ...datos, actualizadoEn: new Date().toISOString(), actualizadoPor: adminUid });

  await registrarEvento({
    uid: adminUid, nombre: adminNombre, rol: "administrador", liceoId: "plataforma",
    accion: "plan_comercial.actualizar", recurso: "planes_comerciales", recursoId: planId, resultado: "permitido",
    detalle: anterior
      ? `Precio: ${anterior.precio} → ${datos.precio}. Estado: ${anterior.estado} → ${datos.estado}.`
      : `Precio nuevo: ${datos.precio}. Estado nuevo: ${datos.estado}.`,
  });
}

/** Reemplaza la lista compartida "¿Qué incluye SIGEDUAL?". */
export async function actualizarCaracteristicas(items: string[], adminUid: string, adminNombre: string): Promise<void> {
  await setDoc(doc(db, "configuracion_comercial", CARACTERISTICAS_DOC_ID), {
    items, actualizadoEn: new Date().toISOString(), actualizadoPor: adminUid,
  });
  await registrarEvento({
    uid: adminUid, nombre: adminNombre, rol: "administrador", liceoId: "plataforma",
    accion: "plan_comercial.actualizar_caracteristicas", recurso: "configuracion_comercial", recursoId: CARACTERISTICAS_DOC_ID,
    resultado: "permitido", detalle: `${items.length} características configuradas.`,
  });
}
