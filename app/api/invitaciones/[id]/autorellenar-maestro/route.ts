import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, updateDocumentFields, setDocument, addDocument } from "@/lib/firebase-admin";
import { verificarAccesoInvitacion } from "@/lib/invitaciones/autorizacion";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import { normalizarRut } from "@/lib/rut";
import type { EstadoInvitacion, EstadoMaestroGuia, Rol } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ValoresMaestro {
  nombres: string; apellidoPaterno: string; apellidoMaterno: string; run: string;
  email: string; telefono: string; cargo: string; area: string;
  aniosExperiencia: string; capacidad: string; estado: EstadoMaestroGuia; observaciones: string;
}

interface CuerpoAutorellenar {
  centroDualId: string;
  maestroGuiaIdExistente?: string;
  valores: ValoresMaestro;
  especialidades: string[];
  areas: string[];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const uid = await requireCallerUid(request);
    const invitacion = await getDocument(`invitaciones/${id}`);
    if (!invitacion) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }
    const datosInvitacion = invitacion.data as { estado: EstadoInvitacion; liceoId: string; profesorUid: string };
    if (!(await verificarAccesoInvitacion(uid, datosInvitacion))) {
      return NextResponse.json({ error: "No autorizado para procesar esta invitación." }, { status: 403 });
    }

    const body = (await request.json()) as CuerpoAutorellenar;
    const v = body.valores;
    if (!v?.nombres?.trim() || !body.centroDualId) {
      return NextResponse.json({ error: "Faltan datos obligatorios (nombre o centro dual)." }, { status: 400 });
    }

    const centro = await getDocument(`centros_duales/${body.centroDualId}`);
    if (!centro) {
      return NextResponse.json({ error: "El centro dual indicado no existe." }, { status: 404 });
    }

    const ahora = new Date().toISOString();
    const datosMaestro: Record<string, unknown> = {
      centroDualId: body.centroDualId,
      liceoId: datosInvitacion.liceoId,
      nombres: v.nombres.trim(),
      apellidoPaterno: v.apellidoPaterno?.trim() ?? "",
      apellidoMaterno: v.apellidoMaterno?.trim() ?? "",
      run: v.run?.trim() ? normalizarRut(v.run) : "",
      email: v.email?.trim() ?? "",
      telefono: v.telefono?.trim() ?? "",
      cargo: v.cargo?.trim() ?? "",
      area: v.area?.trim() ?? "",
      especialidades: body.especialidades ?? [],
      areasSupervision: body.areas ?? [],
      estado: v.estado,
      observaciones: v.observaciones?.trim() ?? "",
      aniosExperiencia: v.aniosExperiencia?.trim() ? Number(v.aniosExperiencia) : undefined,
      capacidad: v.capacidad?.trim() ? Number(v.capacidad) : undefined,
    };

    let maestroGuiaId: string;
    if (body.maestroGuiaIdExistente) {
      maestroGuiaId = body.maestroGuiaIdExistente;
      await updateDocumentFields(`maestros_guia/${maestroGuiaId}`, { ...datosMaestro, actualizadoEn: ahora });
    } else {
      maestroGuiaId = await addDocument("maestros_guia", { ...datosMaestro, creadoPor: uid, creadoEn: ahora });
    }

    await setDocument(`autorizaciones/${datosInvitacion.profesorUid}_maestro_${maestroGuiaId}`, {
      profesorUid: datosInvitacion.profesorUid,
      tipo: "maestro",
      recursoId: maestroGuiaId,
      liceoId: datosInvitacion.liceoId,
      origen: "invitacion",
      invitacionId: id,
      creadoEn: ahora,
    });

    const usuarioDoc = await getDocument(`usuarios/${uid}`);
    await registrarEventoServidor({
      uid,
      nombre: (usuarioDoc?.data.nombre as string) ?? uid,
      rol: (usuarioDoc?.data.rol as Rol) ?? "profesor",
      liceoId: datosInvitacion.liceoId,
      accion: "autorellenar_maestro",
      recurso: "maestros_guia",
      recursoId: maestroGuiaId,
      resultado: "permitido",
      detalle: `Autorrellenado desde la invitación ${id}${body.maestroGuiaIdExistente ? " (actualizó un maestro guía existente)" : " (creó un maestro guía nuevo)"}.`,
    });

    return NextResponse.json({ ok: true, maestroGuiaId });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    const noAutorizado = detalle.startsWith("No autorizado");
    return NextResponse.json({ error: detalle }, { status: noAutorizado ? 403 : 500 });
  }
}
