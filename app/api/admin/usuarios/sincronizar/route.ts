import { NextResponse } from "next/server";
import { requireAdmin, listAuthUids, listFirestoreUsuarioIds, deleteFirestoreUsuario } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Elimina de Firestore ("usuarios") a quienes ya no existen en
 * Firebase Authentication — por ejemplo, alguien borrado a mano
 * desde la consola de Firebase.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const [uidsValidos, idsFirestore] = await Promise.all([listAuthUids(), listFirestoreUsuarioIds()]);
    const eliminados = idsFirestore.filter((id) => !uidsValidos.has(id));

    await Promise.all(eliminados.map((id) => deleteFirestoreUsuario(id)));

    return NextResponse.json({ ok: true, eliminados });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado al sincronizar.";
    const noAutorizado = mensaje.startsWith("No autorizado");
    return NextResponse.json({ error: mensaje }, { status: noAutorizado ? 403 : 500 });
  }
}
