import { NextResponse } from "next/server";
import { adminAuth, adminDb, requireAdmin } from "@/lib/firebase-admin";

/**
 * Elimina de Firestore ("usuarios") a quienes ya no existen en
 * Firebase Authentication — por ejemplo, alguien borrado a mano
 * desde la consola de Firebase.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const uidsValidos = new Set<string>();
    let pageToken: string | undefined;
    do {
      const pagina = await adminAuth().listUsers(1000, pageToken);
      pagina.users.forEach((u) => uidsValidos.add(u.uid));
      pageToken = pagina.pageToken;
    } while (pageToken);

    const snap = await adminDb().collection("usuarios").get();
    const eliminados: string[] = [];

    await Promise.all(
      snap.docs.map(async (doc) => {
        if (!uidsValidos.has(doc.id)) {
          eliminados.push(doc.id);
          await doc.ref.delete();
        }
      })
    );

    return NextResponse.json({ ok: true, eliminados });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado al sincronizar.";
    const noAutorizado = mensaje.startsWith("No autorizado");
    return NextResponse.json({ error: mensaje }, { status: noAutorizado ? 403 : 500 });
  }
}
