import { NextResponse } from "next/server";
import { getDocument, updateDocumentFields, listCollectionDocs } from "@/lib/firebase-admin";
import type { EstadoCampania } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RespuestaPublica {
  liceoNombre: string;
  profesorNombre: string;
  especialidades: { id: string; nombre: string }[];
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const campania = await getDocument(`campanias_invitacion_estudiante/${token}`);
    if (!campania) {
      return NextResponse.json({ error: "Este enlace no es válido." }, { status: 404 });
    }

    const datos = campania.data as {
      estado: EstadoCampania;
      liceoId: string;
      profesorNombre: string;
      capacidad: number;
      respuestasCount: number;
      expiraEn?: string;
    };

    let estado = datos.estado;
    if (estado === "activa" && datos.expiraEn && new Date(datos.expiraEn) < new Date()) {
      estado = "expirada";
      await updateDocumentFields(`campanias_invitacion_estudiante/${token}`, { estado: "expirada" });
    }

    if (estado === "revocada") {
      return NextResponse.json({ error: "Este formulario fue revocado por el liceo." }, { status: 410 });
    }
    if (estado === "expirada") {
      return NextResponse.json({ error: "Este formulario ya no está disponible." }, { status: 410 });
    }
    if (estado === "completa" || datos.respuestasCount >= datos.capacidad) {
      return NextResponse.json({ error: "Ya no se aceptan respuestas para este formulario." }, { status: 409 });
    }

    await updateDocumentFields(`campanias_invitacion_estudiante/${token}`, { ultimoAccesoEn: new Date().toISOString() });

    const todasEspecialidades = await listCollectionDocs("especialidades");
    const especialidades = todasEspecialidades
      .filter((e) => e.data.liceoId === datos.liceoId && e.data.estado !== "inactiva")
      .map((e) => ({ id: e.id, nombre: e.data.nombre as string }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const respuesta: RespuestaPublica = {
      liceoNombre: "SIGEDUAL",
      profesorNombre: datos.profesorNombre,
      especialidades,
    };
    const liceo = await getDocument(`liceos/${datos.liceoId}`);
    if (liceo?.data.nombre) respuesta.liceoNombre = liceo.data.nombre as string;

    return NextResponse.json(respuesta);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible cargar el formulario. (${detalle})` }, { status: 500 });
  }
}
