import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, listCollectionDocs } from "@/lib/firebase-admin";
import { verificarAccesoInvitacion } from "@/lib/invitaciones/autorizacion";
import { normalizarRut } from "@/lib/rut";
import type { CentroDual } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const uid = await requireCallerUid(request);
    const campania = await getDocument(`campanias_invitacion/${id}`);
    if (!campania) {
      return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    }
    const datos = campania.data as { liceoId: string; profesorUid: string };
    if (!(await verificarAccesoInvitacion(uid, datos))) {
      return NextResponse.json({ error: "No autorizado para revisar esta campaña." }, { status: 403 });
    }

    const respuestas = await listCollectionDocs("respuestas_campania");
    const propias = respuestas.filter((r) => r.data.campaniaId === id);

    const resultado: Record<string, CentroDual | null> = {};
    for (const r of propias) {
      const empresa = r.data.empresa as { rut?: string } | undefined;
      const rut = empresa?.rut;
      if (!rut?.trim()) {
        resultado[r.id] = null;
        continue;
      }
      const indice = await getDocument(`centros_duales_por_rut/${normalizarRut(rut)}`);
      if (!indice) {
        resultado[r.id] = null;
        continue;
      }
      const centroDoc = await getDocument(`centros_duales/${indice.data.centroDualId}`);
      resultado[r.id] = centroDoc ? ({ id: centroDoc.id, ...centroDoc.data } as CentroDual) : null;
    }

    return NextResponse.json({ duplicados: resultado });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
