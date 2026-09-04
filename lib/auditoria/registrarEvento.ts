import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Rol } from "@/types";

export type ResultadoAuditoria = "permitido" | "denegado";

interface EventoAuditoria {
  uid: string;
  nombre: string;
  rol: Rol;
  liceoId: string;
  accion: string;
  recurso: string;
  recursoId?: string;
  resultado: ResultadoAuditoria;
  detalle?: string;
}

/** Igual que `EventoAuditoria`, pero para eventos que no origina un usuario
 * autenticado de SIGEDUAL (ej: una empresa externa enviando un formulario
 * de invitación) — `rol` acepta "externo" para ese caso. */
interface EventoAuditoriaServidor extends Omit<EventoAuditoria, "rol"> {
  rol: Rol | "externo";
}

/**
 * Registra un evento de auditoría relevante: denegaciones de acceso (un
 * profesor intentando ver un recurso fuera de su ámbito) y acciones
 * administrativas sensibles (cambio de rol/liceo de un usuario, cambio de
 * estado de un ticket, reasignación de un profesor supervisor). No se
 * audita cada lectura exitosa — solo lo que representa una decisión de
 * autorización o un cambio con impacto institucional.
 *
 * Fire-and-forget: nunca debe bloquear la navegación ni la acción que
 * origina el evento, por eso siempre se llama sin `await` bloqueante desde
 * el código que la invoca y se protege con try/catch aquí mismo.
 */
export async function registrarEvento(evento: EventoAuditoria): Promise<void> {
  try {
    await addDoc(collection(db, "auditoria"), { ...evento, creadoEn: new Date().toISOString() });
  } catch {
    // Un fallo al auditar nunca debe impedir la acción original.
  }
}

/** Igual que `registrarEvento`, pero escrito desde una ruta de API de
 * servidor con privilegio de cuenta de servicio — para eventos que ocurren
 * sin sesión de Firebase Auth (formulario enviado por una empresa externa)
 * o donde ya se verificó la identidad vía `requireCallerUid` en vez del SDK
 * de cliente. */
export async function registrarEventoServidor(evento: EventoAuditoriaServidor): Promise<void> {
  try {
    const { addDocument } = await import("@/lib/firebase-admin");
    await addDocument("auditoria", { ...evento, creadoEn: new Date().toISOString() });
  } catch {
    // Un fallo al auditar nunca debe impedir la acción original.
  }
}
