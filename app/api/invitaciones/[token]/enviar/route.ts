import { NextResponse } from "next/server";
import { getDocument, updateDocumentFields, setDocument } from "@/lib/firebase-admin";
import { crearNotificacionServidor } from "@/lib/notificaciones/crearNotificacion";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import type { EstadoInvitacion, RespuestaInvitacion, RespuestaMaestroGuiaInvitacion } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CuerpoEnvio {
  empresa: RespuestaInvitacion["empresa"];
  perfil: RespuestaInvitacion["perfil"];
  necesidades: RespuestaInvitacion["necesidades"];
  caracteristicas: RespuestaInvitacion["caracteristicas"];
  capacidad: RespuestaInvitacion["capacidad"];
  maestrosGuia: Omit<RespuestaMaestroGuiaInvitacion, "id">[];
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const invitacion = await getDocument(`invitaciones/${token}`);
    if (!invitacion) {
      return NextResponse.json({ error: "Este enlace de invitación no es válido." }, { status: 404 });
    }

    const datosInvitacion = invitacion.data as {
      estado: EstadoInvitacion;
      liceoId: string;
      profesorUid: string;
      profesorNombre: string;
      expiraEn?: string;
    };

    if (datosInvitacion.estado === "revocado") {
      return NextResponse.json({ error: "Este enlace de invitación fue revocado por el liceo." }, { status: 410 });
    }
    if (datosInvitacion.expiraEn && new Date(datosInvitacion.expiraEn) < new Date()) {
      await updateDocumentFields(`invitaciones/${token}`, { estado: "expirado" });
      return NextResponse.json({ error: "Este enlace de invitación ha expirado." }, { status: 410 });
    }
    if (datosInvitacion.estado === "enviado" || datosInvitacion.estado === "en_revision" || datosInvitacion.estado === "procesado") {
      return NextResponse.json({ error: "Este formulario ya fue enviado anteriormente." }, { status: 409 });
    }

    const body = (await request.json()) as CuerpoEnvio;

    const razonSocial = body.empresa?.razonSocial?.trim();
    if (!razonSocial) {
      return NextResponse.json({ error: "El nombre de la empresa es obligatorio." }, { status: 400 });
    }
    const maestrosValidos = (body.maestrosGuia ?? []).filter((m) => m.nombres?.trim());
    if (maestrosValidos.length === 0) {
      return NextResponse.json({ error: "Debes ingresar al menos un Maestro Guía." }, { status: 400 });
    }

    const ahora = new Date().toISOString();
    const respuesta: Omit<RespuestaInvitacion, "id"> = {
      invitacionId: token,
      liceoId: datosInvitacion.liceoId,
      empresa: body.empresa ?? {},
      perfil: body.perfil ?? {},
      necesidades: body.necesidades ?? {},
      caracteristicas: body.caracteristicas ?? {},
      capacidad: body.capacidad ?? {},
      maestrosGuia: maestrosValidos.map((m) => ({ ...m, id: crypto.randomUUID() })),
      creadoEn: ahora,
      enviadoEn: ahora,
    };

    await setDocument(`respuestas_invitacion/${token}`, respuesta);
    await updateDocumentFields(`invitaciones/${token}`, { estado: "enviado", enviadoEn: ahora });

    await crearNotificacionServidor({
      destinatarioUid: datosInvitacion.profesorUid,
      liceoId: datosInvitacion.liceoId,
      tipo: "formulario_recibido",
      titulo: "Formulario de Empresa Dual recibido",
      descripcion: `${razonSocial} completó el formulario de la invitación que enviaste.`,
      prioridad: "media",
      accionHref: `/dashboard/centros/invitaciones/${token}`,
      accionLabel: "Revisar formulario",
    });

    await registrarEventoServidor({
      uid: `invitacion:${token}`,
      nombre: razonSocial,
      rol: "externo",
      liceoId: datosInvitacion.liceoId,
      accion: "formulario_enviado",
      recurso: "invitaciones",
      recursoId: token,
      resultado: "permitido",
      detalle: `Formulario enviado por ${razonSocial} para la invitación generada por ${datosInvitacion.profesorNombre}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible enviar el formulario. Intenta nuevamente. (${detalle})` }, { status: 500 });
  }
}
