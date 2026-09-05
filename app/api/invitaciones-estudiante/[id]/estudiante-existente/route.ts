import { NextResponse } from "next/server";
import { requireCallerUid, getDocument } from "@/lib/firebase-admin";
import { verificarAccesoInvitacion } from "@/lib/invitaciones/autorizacion";
import { normalizarRut } from "@/lib/rut";
import type { Estudiante, EstadoInvitacion } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const uid = await requireCallerUid(request);
    const invitacion = await getDocument(`invitaciones_estudiante/${id}`);
    if (!invitacion) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }
    const datosInvitacion = invitacion.data as { estado: EstadoInvitacion; liceoId: string; profesorUid: string };
    if (!(await verificarAccesoInvitacion(uid, datosInvitacion))) {
      return NextResponse.json({ error: "No autorizado para revisar esta invitación." }, { status: 403 });
    }

    const respuesta = await getDocument(`respuestas_invitacion_estudiante/${id}`);
    const run = respuesta?.data.run as string | undefined;
    if (!run?.trim()) {
      return NextResponse.json({ estudianteExistente: null });
    }

    const indice = await getDocument(`estudiantes_por_run/${normalizarRut(run)}`);
    if (!indice) {
      return NextResponse.json({ estudianteExistente: null });
    }
    const estudianteDoc = await getDocument(`estudiantes/${indice.data.estudianteId}`);
    const estudianteExistente = estudianteDoc ? ({ id: estudianteDoc.id, ...estudianteDoc.data } as Estudiante) : null;
    return NextResponse.json({ estudianteExistente });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
