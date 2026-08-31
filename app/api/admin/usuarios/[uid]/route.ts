import { NextResponse } from "next/server";
import { adminAuth, adminDb, requireAdmin } from "@/lib/firebase-admin";

export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;

  try {
    await requireAdmin(request);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No autorizado";
    return NextResponse.json({ error: mensaje }, { status: 403 });
  }

  try {
    await adminDb().doc(`usuarios/${uid}`).delete();
  } catch {
    // Si el documento ya no existe en Firestore, no es un problema: seguimos.
  }

  try {
    await adminAuth().deleteUser(uid);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "auth/user-not-found") {
      const mensaje = err instanceof Error ? err.message : "Error al eliminar la cuenta en Firebase";
      return NextResponse.json({ error: mensaje }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
