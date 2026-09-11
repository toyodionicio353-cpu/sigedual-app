import { collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Notificacion } from "@/types";

/**
 * Da por vistas las notificaciones que apuntan a un recurso concreto.
 *
 * Existe porque una notificación avisa de algo que pasó, no es la cosa en
 * sí: si alguien abre el hilo de mensajes o entra al ticket por su propia
 * vía, ya se enteró — que el aviso siguiera ahí sin leer obliga a apagarlo
 * a mano y convierte la bandeja en una lista de pendientes falsos.
 *
 * Filtra por `destinatarioUid` en la consulta (un solo campo de igualdad,
 * que las reglas ya permiten y no exige ningún índice compuesto) y descarta
 * el resto en memoria: la bandeja de una persona es pequeña, y así esto no
 * depende de un índice que podría no estar desplegado en Firestore.
 *
 * Silencioso a propósito: no poder marcar un aviso como visto nunca debe
 * romper la acción que el usuario vino a hacer.
 */
export async function marcarNotificacionesDeRecurso(
  destinatarioUid: string,
  recurso: string,
  recursoId: string
): Promise<void> {
  if (!destinatarioUid || !recursoId) return;
  try {
    const snap = await getDocs(
      query(collection(db, "notificaciones"), where("destinatarioUid", "==", destinatarioUid))
    );
    const pendientes = snap.docs.filter((d) => {
      const n = d.data() as Notificacion;
      return n.leida !== true && n.recurso === recurso && n.recursoId === recursoId;
    });
    if (pendientes.length === 0) return;

    const ahora = new Date().toISOString();
    const lote = writeBatch(db);
    pendientes.forEach((d) => lote.update(d.ref, { leida: true, leidaEn: ahora }));
    await lote.commit();
  } catch {
    // Sin efecto visible: el usuario ya está viendo el recurso.
  }
}
