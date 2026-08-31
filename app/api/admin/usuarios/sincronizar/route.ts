import { NextResponse } from "next/server";
import { requireAdmin, listAuthAccounts, listFirestoreUsuarioIds, deleteFirestoreUsuario } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compara Firestore ("usuarios") contra Firebase Authentication:
 * - Elimina fichas de Firestore cuya cuenta ya no existe en Auth
 *   (alguien borrado a mano desde la consola de Firebase).
 * - Reporta cuentas de Auth que no tienen ficha en Firestore
 *   (alguien creado a mano en la consola de Firebase, al que le
 *   falta nombre/rol/liceo) para que el administrador las complete.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const [cuentasAuth, idsFirestore] = await Promise.all([listAuthAccounts(), listFirestoreUsuarioIds()]);
    const idsFirestoreSet = new Set(idsFirestore);
    const uidsAuthSet = new Set(cuentasAuth.map((c) => c.uid));

    const eliminados = idsFirestore.filter((id) => !uidsAuthSet.has(id));
    const huerfanos = cuentasAuth.filter((c) => !idsFirestoreSet.has(c.uid));

    await Promise.all(eliminados.map((id) => deleteFirestoreUsuario(id)));

    return NextResponse.json({
      ok: true,
      eliminados,
      huerfanos,
      diagnostico: {
        totalCuentasAuth: cuentasAuth.length,
        correosAuth: cuentasAuth.map((c) => c.email),
        totalFichasFirestore: idsFirestore.length,
      },
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado al sincronizar.";
    const noAutorizado = mensaje.startsWith("No autorizado");
    return NextResponse.json({ error: mensaje }, { status: noAutorizado ? 403 : 500 });
  }
}
