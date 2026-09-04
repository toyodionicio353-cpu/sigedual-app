import { NextResponse } from "next/server";
import { requireCallerUid, getDocument } from "@/lib/firebase-admin";
import { normalizarRut } from "@/lib/rut";
import type { Rol } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Indica si en SIGEDUAL ya existe un Centro Dual con el mismo RUT que la
 * empresa que respondió esta invitación — usando el índice inverso
 * `centros_duales_por_rut`, que un profesor no puede leer directamente por
 * regla de Firestore (solo quien tiene acceso completo al liceo). Como esta
 * comparación es parte de revisar el formulario (no una escritura), pasa
 * por una ruta autenticada con privilegio de servidor en vez de abrir esa
 * regla al cliente.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const uid = await requireCallerUid(request);
    const invitacion = await getDocument(`invitaciones/${id}`);
    if (!invitacion) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }
    const datosInvitacion = invitacion.data as { profesorUid: string; liceoId: string };

    const usuarioDoc = await getDocument(`usuarios/${uid}`);
    const rol = usuarioDoc?.data.rol as Rol | undefined;
    const liceoIdUsuario = usuarioDoc?.data.liceoId as string | undefined;
    const autorizado =
      datosInvitacion.profesorUid === uid ||
      rol === "administrador" ||
      ((rol === "director" || rol === "coordinador") && liceoIdUsuario === datosInvitacion.liceoId);
    if (!autorizado) {
      return NextResponse.json({ error: "No autorizado para revisar esta invitación." }, { status: 403 });
    }

    const respuesta = await getDocument(`respuestas_invitacion/${id}`);
    const rut = (respuesta?.data.empresa as { rut?: string } | undefined)?.rut;
    if (!rut) {
      return NextResponse.json({ centroExistente: null });
    }

    const indice = await getDocument(`centros_duales_por_rut/${normalizarRut(rut)}`);
    if (!indice) {
      return NextResponse.json({ centroExistente: null });
    }

    const centroDualId = indice.data.centroDualId as string;
    const centro = await getDocument(`centros_duales/${centroDualId}`);
    return NextResponse.json({ centroExistente: centro ? { id: centro.id, ...centro.data } : null });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    const noAutorizado = detalle.startsWith("No autorizado");
    return NextResponse.json({ error: detalle }, { status: noAutorizado ? 403 : 500 });
  }
}
