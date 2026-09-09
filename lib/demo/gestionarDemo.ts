import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import { calcularVencimiento } from "@/lib/demo";
import type { DemoInstancia } from "@/types";

/**
 * Genera un nuevo enlace de demostración. El token es el propio id del
 * documento (mismo patrón que `invitaciones`/`campanias_invitacion`):
 * `crypto.randomUUID()`, no predecible y no secuencial. El período de 168
 * horas comienza en este instante — no cuando alguien abra el enlace.
 */
export async function generarDemo(params: { administradorUid: string; administradorNombre: string }): Promise<DemoInstancia> {
  const token = crypto.randomUUID();
  const emitidoEn = new Date().toISOString();
  const demo: DemoInstancia = {
    id: token,
    estado: "activa",
    emitidoEn,
    venceEn: calcularVencimiento(emitidoEn),
    generadoPor: params.administradorUid,
    generadoPorNombre: params.administradorNombre,
  };
  await setDoc(doc(db, "demos", token), demo);
  await registrarEvento({
    uid: params.administradorUid, nombre: params.administradorNombre, rol: "desarrollador",
    liceoId: "plataforma", accion: "demo.generar", recurso: "demos", recursoId: token, resultado: "permitido",
  });
  return demo;
}

/** Invalida manualmente un enlace de demostración antes de su vencimiento. */
export async function cancelarDemo(params: {
  demoId: string; administradorUid: string; administradorNombre: string;
}): Promise<void> {
  const ahora = new Date().toISOString();
  await updateDoc(doc(db, "demos", params.demoId), {
    estado: "cancelada", canceladoEn: ahora, canceladoPor: params.administradorUid,
  });
  await registrarEvento({
    uid: params.administradorUid, nombre: params.administradorNombre, rol: "desarrollador",
    liceoId: "plataforma", accion: "demo.cancelar", recurso: "demos", recursoId: params.demoId, resultado: "permitido",
  });
}
