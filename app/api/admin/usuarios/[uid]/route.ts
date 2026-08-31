import { NextResponse } from "next/server";
import { requireAdmin, deleteFirestoreUsuario, deleteAuthUser } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;

  try {
    await requireAdmin(request);
    await deleteFirestoreUsuario(uid);
    await deleteAuthUser(uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado al eliminar el usuario.";
    const noAutorizado = mensaje.startsWith("No autorizado");
    return NextResponse.json({ error: mensaje }, { status: noAutorizado ? 403 : 500 });
  }
}
