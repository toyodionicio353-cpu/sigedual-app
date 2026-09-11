import { NextResponse } from "next/server";
import {
  requireAdmin, getDocument, listCollectionDocs, deleteDocument,
} from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import type { Rol } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subcolecciones que cuelgan de un ticket. Firestore NO borra en cascada:
 * eliminar solo el documento padre dejaría estos mensajes y notas como
 * basura invisible, imposible de leer (su regla consulta un ticket que ya
 * no existe) e imposible de borrar después. */
const SUBCOLECCIONES = ["mensajes", "notasInternas"] as const;

/**
 * Elimina un ticket completo. Solo el rol desarrollador, verificado por
 * `requireAdmin` contra Firestore.
 *
 * Pasa por el servidor y no por el cliente porque el hilo de mensajes es
 * inmutable a propósito (`allow update, delete: if false` en
 * firestore.rules): nadie puede borrar un mensaje suelto para reescribir
 * la historia de un ticket. Borrar el ticket entero es otra cosa, y se
 * hace acá con la cuenta de servicio, sin relajar esa regla.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const solicitanteUid = await requireAdmin(request);

    const ticket = await getDocument(`tickets/${id}`);
    if (!ticket) {
      return NextResponse.json({ error: "Ese ticket ya no existe." }, { status: 404 });
    }

    // Primero las subcolecciones: si algo falla a mitad de camino, el
    // ticket sigue ahí y se puede reintentar. Al revés quedaría huérfano.
    for (const sub of SUBCOLECCIONES) {
      const docs = await listCollectionDocs(`tickets/${id}/${sub}`);
      for (const d of docs) {
        await deleteDocument(`tickets/${id}/${sub}/${d.id}`);
      }
    }
    await deleteDocument(`tickets/${id}`);

    // Sus avisos de la campana apuntan a un ticket que ya no existe: si
    // quedaran, el usuario haría clic y solo vería "no existe". Se listan
    // todas y se filtran en memoria porque el cliente REST de este
    // proyecto no hace consultas con filtro; eliminar un ticket es una
    // acción administrativa rara, así que el costo es despreciable.
    const avisos = await listCollectionDocs("notificaciones");
    for (const aviso of avisos) {
      if (aviso.data.recurso === "ticket" && aviso.data.recursoId === id) {
        await deleteDocument(`notificaciones/${aviso.id}`);
      }
    }

    const solicitante = await getDocument(`usuarios/${solicitanteUid}`);
    await registrarEventoServidor({
      uid: solicitanteUid,
      nombre: (solicitante?.data.nombre as string) ?? "",
      rol: ((solicitante?.data.rol as Rol) ?? "desarrollador"),
      liceoId: (solicitante?.data.liceoId as string) ?? "",
      accion: "eliminar_ticket",
      recurso: "tickets",
      recursoId: id,
      resultado: "permitido",
      detalle: (ticket.data.asunto as string) ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado al eliminar el ticket.";
    const noAutorizado = mensaje.startsWith("No autorizado");
    return NextResponse.json({ error: mensaje }, { status: noAutorizado ? 403 : 500 });
  }
}
