import { runTransaction, doc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { crearNotificacion } from "@/lib/notificaciones/crearNotificacion";
import { numeroTicket } from "./constantes";
import type { PrioridadTicket, TipoTicket } from "@/types";

interface DatosTicket {
  asunto: string;
  descripcion: string;
  tipo: TipoTicket;
  prioridad: PrioridadTicket;
  creadoPor: string;
  creadoPorNombre: string;
  liceoId: string;
}

/** Crea un ticket con numeración secuencial real (contador atómico vía
 * transacción, sin colisiones) y notifica a los administradores de la
 * plataforma — el mismo sistema de notificaciones que alimenta la campana
 * global y la tarjeta de Inicio. */
export async function crearTicket(datos: DatosTicket): Promise<{ id: string; numero: number }> {
  const contadorRef = doc(db, "contadores", "tickets");
  const ticketRef = doc(collection(db, "tickets"));

  const numero = await runTransaction(db, async (tx) => {
    const snap = await tx.get(contadorRef);
    const siguiente = (snap.exists() ? (snap.data().siguiente as number) : 0) + 1;
    tx.set(contadorRef, { siguiente }, { merge: true });
    tx.set(ticketRef, {
      numero: siguiente,
      asunto: datos.asunto,
      descripcion: datos.descripcion,
      tipo: datos.tipo,
      prioridad: datos.prioridad,
      estado: "nuevo",
      creadoPor: datos.creadoPor,
      creadoPorNombre: datos.creadoPorNombre,
      liceoId: datos.liceoId,
      creadoEn: new Date().toISOString(),
    });
    return siguiente;
  });

  const snapAdmins = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "administrador")));
  await Promise.all(
    snapAdmins.docs.map((d) =>
      crearNotificacion({
        destinatarioUid: d.id,
        liceoId: datos.liceoId,
        tipo: "ticket",
        titulo: `Nuevo ticket: ${numeroTicket(numero)}`,
        descripcion: `${datos.creadoPorNombre}: "${datos.asunto}"`,
        prioridad: datos.prioridad === "critica" ? "alta" : datos.prioridad === "alta" ? "alta" : "media",
        accionHref: `/dashboard/soporte/tickets/${ticketRef.id}`,
        accionLabel: "Ver ticket",
      })
    )
  );

  return { id: ticketRef.id, numero };
}
