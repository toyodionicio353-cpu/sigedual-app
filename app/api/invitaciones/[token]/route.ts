import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, updateDocumentFields, deleteDocument } from "@/lib/firebase-admin";
import { verificarAccesoInvitacion } from "@/lib/invitaciones/autorizacion";
import type { EstadoInvitacion } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Datos mínimos que necesita el formulario público para renderizarse —
 * nunca se exponen datos internos de SIGEDUAL (nombre real del centro,
 * otros profesores, etc.), solo lo que el propio profesor definió al
 * generar la invitación. */
interface RespuestaPublica {
  estado: EstadoInvitacion;
  liceoNombre: string;
  profesorNombre: string;
  especialidadNombre?: string;
  cursos?: string[];
  nombrePreliminar?: string;
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const invitacion = await getDocument(`invitaciones/${token}`);
    if (!invitacion) {
      return NextResponse.json({ error: "Este enlace de invitación no es válido." }, { status: 404 });
    }

    const datos = invitacion.data as {
      estado: EstadoInvitacion;
      liceoId: string;
      profesorNombre: string;
      especialidadId?: string;
      cursos?: string[];
      nombrePreliminar?: string;
      expiraEn?: string;
    };

    let estado = datos.estado;
    if (estado !== "revocado" && estado !== "expirado" && datos.expiraEn && new Date(datos.expiraEn) < new Date()) {
      estado = "expirado";
      await updateDocumentFields(`invitaciones/${token}`, { estado: "expirado" });
    }

    if (estado === "revocado") {
      return NextResponse.json({ error: "Este enlace de invitación fue revocado por el liceo." }, { status: 410 });
    }
    if (estado === "expirado") {
      return NextResponse.json({ error: "Este enlace de invitación ha expirado." }, { status: 410 });
    }

    if (estado === "generado") {
      estado = "abierto";
      await updateDocumentFields(`invitaciones/${token}`, { estado: "abierto", ultimoAccesoEn: new Date().toISOString() });
    } else {
      await updateDocumentFields(`invitaciones/${token}`, { ultimoAccesoEn: new Date().toISOString() });
    }

    const liceo = await getDocument(`liceos/${datos.liceoId}`);
    const especialidad = datos.especialidadId ? await getDocument(`especialidades/${datos.especialidadId}`) : null;

    const respuesta: RespuestaPublica = {
      estado,
      liceoNombre: (liceo?.data.nombre as string) ?? "SIGEDUAL",
      profesorNombre: datos.profesorNombre,
      ...(especialidad ? { especialidadNombre: especialidad.data.nombre as string } : {}),
      ...(datos.cursos ? { cursos: datos.cursos } : {}),
      ...(datos.nombrePreliminar ? { nombrePreliminar: datos.nombrePreliminar } : {}),
    };

    return NextResponse.json(respuesta);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible cargar la invitación. (${detalle})` }, { status: 500 });
  }
}

/** Elimina el formulario recibido (invitación + su respuesta, si existe) de
 * la bandeja — no borra ningún centro dual/maestro guía ya creado a partir
 * de él. */
export async function DELETE(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const uid = await requireCallerUid(request);
    const invitacion = await getDocument(`invitaciones/${token}`);
    if (!invitacion) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }
    if (!(await verificarAccesoInvitacion(uid, invitacion.data as { profesorUid: string; liceoId: string }))) {
      return NextResponse.json({ error: "No autorizado para eliminar esta invitación." }, { status: 403 });
    }
    await deleteDocument(`invitaciones/${token}`);
    await deleteDocument(`respuestas_invitacion/${token}`).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    const noAutorizado = detalle.startsWith("No autorizado");
    return NextResponse.json({ error: detalle }, { status: noAutorizado ? 403 : 500 });
  }
}
