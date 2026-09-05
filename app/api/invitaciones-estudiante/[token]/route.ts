import { NextResponse } from "next/server";
import { getDocument, updateDocumentFields, listCollectionDocs } from "@/lib/firebase-admin";
import type { EstadoInvitacion } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Datos mínimos que necesita el formulario público para renderizarse —
 * nunca se exponen datos internos de SIGEDUAL (otros estudiantes, otros
 * profesores, etc.), solo lo que el propio profesor definió al generar la
 * invitación y el catálogo de especialidades del liceo (para el Select). */
interface RespuestaPublica {
  estado: EstadoInvitacion;
  liceoNombre: string;
  profesorNombre: string;
  nombrePreliminar?: string;
  especialidades: { id: string; nombre: string }[];
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const invitacion = await getDocument(`invitaciones_estudiante/${token}`);
    if (!invitacion) {
      return NextResponse.json({ error: "Este enlace de invitación no es válido." }, { status: 404 });
    }

    const datos = invitacion.data as {
      estado: EstadoInvitacion;
      liceoId: string;
      profesorNombre: string;
      nombrePreliminar?: string;
      expiraEn?: string;
    };

    let estado = datos.estado;
    if (estado !== "revocado" && estado !== "expirado" && datos.expiraEn && new Date(datos.expiraEn) < new Date()) {
      estado = "expirado";
      await updateDocumentFields(`invitaciones_estudiante/${token}`, { estado: "expirado" });
    }

    if (estado === "revocado") {
      return NextResponse.json({ error: "Este enlace de invitación fue revocado por el liceo." }, { status: 410 });
    }
    if (estado === "expirado") {
      return NextResponse.json({ error: "Este enlace de invitación ha expirado." }, { status: 410 });
    }

    if (estado === "generado") {
      estado = "abierto";
      await updateDocumentFields(`invitaciones_estudiante/${token}`, { estado: "abierto", ultimoAccesoEn: new Date().toISOString() });
    } else {
      await updateDocumentFields(`invitaciones_estudiante/${token}`, { ultimoAccesoEn: new Date().toISOString() });
    }

    const liceo = await getDocument(`liceos/${datos.liceoId}`);
    const todasEspecialidades = await listCollectionDocs("especialidades");
    const especialidades = todasEspecialidades
      .filter((e) => e.data.liceoId === datos.liceoId && e.data.estado !== "inactiva")
      .map((e) => ({ id: e.id, nombre: e.data.nombre as string }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const respuesta: RespuestaPublica = {
      estado,
      liceoNombre: (liceo?.data.nombre as string) ?? "SIGEDUAL",
      profesorNombre: datos.profesorNombre,
      especialidades,
      ...(datos.nombrePreliminar ? { nombrePreliminar: datos.nombrePreliminar } : {}),
    };

    return NextResponse.json(respuesta);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible cargar la invitación. (${detalle})` }, { status: 500 });
  }
}
