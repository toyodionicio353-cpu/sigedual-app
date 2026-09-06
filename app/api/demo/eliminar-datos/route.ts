import { NextResponse } from "next/server";
import { requireCallerUid, getDocument } from "@/lib/firebase-admin";
import { eliminarDatosDemo } from "@/lib/demo/eliminarDatosDemo";
import type { Liceo, Usuario } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Solo el director de la propia institución Demo puede solicitar la
 * eliminación de sus datos — nunca por id de liceo recibido del cliente,
 * siempre resuelto desde el uid verificado del token de sesión.
 */
export async function POST(request: Request) {
  try {
    const uid = await requireCallerUid(request);
    const usuarioDoc = await getDocument(`usuarios/${uid}`);
    if (!usuarioDoc) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    const usuario = usuarioDoc.data as unknown as Usuario;
    if (usuario.rol !== "director") {
      return NextResponse.json({ error: "Solo el director de la institución puede eliminar los datos de la demostración." }, { status: 403 });
    }

    const liceoDoc = await getDocument(`liceos/${usuario.liceoId}`);
    if (!liceoDoc) return NextResponse.json({ error: "Institución no encontrada." }, { status: 404 });
    const liceo = liceoDoc.data as unknown as Liceo;
    if (!liceo.esDemo || !liceo.demoId) {
      return NextResponse.json({ error: "Esta institución no corresponde a una demostración." }, { status: 400 });
    }

    const resultado = await eliminarDatosDemo({
      liceoId: usuario.liceoId, demoId: liceo.demoId, solicitadoPor: uid, solicitadoPorNombre: usuario.nombre,
    });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible eliminar los datos de la demostración. (${detalle})` }, { status: 500 });
  }
}
