import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, listCollectionDocs } from "@/lib/firebase-admin";
import { verificarAccesoInvitacion } from "@/lib/invitaciones/autorizacion";
import { normalizarRut } from "@/lib/rut";
import type { Estudiante } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const uid = await requireCallerUid(request);
    const campania = await getDocument(`campanias_invitacion_estudiante/${id}`);
    if (!campania) {
      return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    }
    const datos = campania.data as { liceoId: string; profesorUid: string };
    if (!(await verificarAccesoInvitacion(uid, datos))) {
      return NextResponse.json({ error: "No autorizado para revisar esta campaña." }, { status: 403 });
    }

    const respuestas = await listCollectionDocs("respuestas_campania_estudiante");
    const propias = respuestas.filter((r) => r.data.campaniaId === id);

    const resultado: Record<string, Estudiante | null> = {};
    for (const r of propias) {
      const run = r.data.run as string | undefined;
      if (!run?.trim()) {
        resultado[r.id] = null;
        continue;
      }
      const indice = await getDocument(`estudiantes_por_run/${normalizarRut(run)}`);
      if (!indice) {
        resultado[r.id] = null;
        continue;
      }
      const estudianteDoc = await getDocument(`estudiantes/${indice.data.estudianteId}`);
      resultado[r.id] = estudianteDoc ? ({ id: estudianteDoc.id, ...estudianteDoc.data } as Estudiante) : null;
    }

    return NextResponse.json({ duplicados: resultado });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
