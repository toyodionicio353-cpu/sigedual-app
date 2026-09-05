import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, updateDocumentFields } from "@/lib/firebase-admin";
import { verificarAccesoInvitacion } from "@/lib/invitaciones/autorizacion";
import type { EstadoRespuestaCampania } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESTADOS_PERMITIDOS: EstadoRespuestaCampania[] = ["revision", "aprobado", "rechazado"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string; respuestaId: string }> }) {
  const { id, respuestaId } = await params;
  try {
    const uid = await requireCallerUid(request);
    const campania = await getDocument(`campanias_invitacion_estudiante/${id}`);
    if (!campania) {
      return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    }
    if (!(await verificarAccesoInvitacion(uid, campania.data as { profesorUid: string; liceoId: string }))) {
      return NextResponse.json({ error: "No autorizado para revisar esta campaña." }, { status: 403 });
    }

    const respuesta = await getDocument(`respuestas_campania_estudiante/${respuestaId}`);
    if (!respuesta || respuesta.data.campaniaId !== id) {
      return NextResponse.json({ error: "Respuesta no encontrada." }, { status: 404 });
    }
    if (respuesta.data.estado === "traspasado") {
      return NextResponse.json({ error: "Esta respuesta ya fue traspasada; su estado no se puede cambiar." }, { status: 409 });
    }

    const { estado } = (await request.json()) as { estado: EstadoRespuestaCampania };
    if (!ESTADOS_PERMITIDOS.includes(estado)) {
      return NextResponse.json({ error: "Estado no permitido." }, { status: 400 });
    }

    await updateDocumentFields(`respuestas_campania_estudiante/${respuestaId}`, { estado });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
