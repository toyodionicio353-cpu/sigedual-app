import { NextResponse } from "next/server";
import { getDocument, updateDocumentFields, setDocument } from "@/lib/firebase-admin";
import { crearNotificacionServidor } from "@/lib/notificaciones/crearNotificacion";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import { validarRut } from "@/lib/rut";
import type { EstadoInvitacion, RespuestaInvitacionEstudiante } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CuerpoEnvio = Omit<RespuestaInvitacionEstudiante, "id" | "invitacionId" | "liceoId" | "creadoEn" | "enviadoEn">;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const invitacion = await getDocument(`invitaciones_estudiante/${token}`);
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
      await updateDocumentFields(`invitaciones_estudiante/${token}`, { estado: "expirado" });
      return NextResponse.json({ error: "Este enlace de invitación ha expirado." }, { status: 410 });
    }
    if (datosInvitacion.estado === "enviado" || datosInvitacion.estado === "en_revision" || datosInvitacion.estado === "procesado") {
      return NextResponse.json({ error: "Este formulario ya fue enviado anteriormente." }, { status: 409 });
    }

    const body = (await request.json()) as CuerpoEnvio;

    if (!body.run?.trim() || !validarRut(body.run)) {
      return NextResponse.json({ error: "El RUN ingresado no es válido." }, { status: 400 });
    }
    if (!body.nombres?.trim() || !body.apellidoPaterno?.trim()) {
      return NextResponse.json({ error: "El nombre y apellido paterno son obligatorios." }, { status: 400 });
    }
    if (!body.nivel?.trim() || !body.curso?.trim()) {
      return NextResponse.json({ error: "El nivel y el curso son obligatorios." }, { status: 400 });
    }
    if (!body.especialidadId?.trim()) {
      return NextResponse.json({ error: "Debes seleccionar una especialidad." }, { status: 400 });
    }

    const ahora = new Date().toISOString();
    const nombreCompleto = `${body.nombres.trim()} ${body.apellidoPaterno.trim()}`.trim();
    const respuesta: Omit<RespuestaInvitacionEstudiante, "id"> = {
      invitacionId: token,
      liceoId: datosInvitacion.liceoId,
      run: body.run.trim(),
      nombres: body.nombres.trim(),
      apellidoPaterno: body.apellidoPaterno.trim(),
      apellidoMaterno: body.apellidoMaterno?.trim() ?? "",
      fechaNacimiento: body.fechaNacimiento ?? "",
      sexo: body.sexo ?? "",
      nacionalidad: body.nacionalidad?.trim() ?? "",
      email: body.email?.trim() ?? "",
      telefono: body.telefono?.trim() ?? "",
      direccion: body.direccion?.trim() ?? "",
      comuna: body.comuna?.trim() ?? "",
      ciudad: body.ciudad?.trim() ?? "",
      anioAcademico: body.anioAcademico?.trim() ?? "",
      nivel: body.nivel.trim(),
      curso: body.curso.trim(),
      especialidadId: body.especialidadId.trim(),
      jornada: body.jornada ?? "",
      enfermedadesCronicas: body.enfermedadesCronicas?.trim() ?? "",
      alergias: body.alergias?.trim() ?? "",
      informacionMedicaAdicional: (body.informacionMedicaAdicional ?? []).map((v) => v.trim()).filter(Boolean),
      rasgos: body.rasgos ?? [],
      habilidades: body.habilidades ?? [],
      apoderadoNombre: body.apoderadoNombre?.trim() ?? "",
      apoderadoRun: body.apoderadoRun?.trim() ?? "",
      apoderadoParentesco: body.apoderadoParentesco ?? "",
      apoderadoTelefono: body.apoderadoTelefono?.trim() ?? "",
      apoderadoEmail: body.apoderadoEmail?.trim() ?? "",
      apoderadoDomicilio: body.apoderadoDomicilio?.trim() ?? "",
      apoderadoCiudad: body.apoderadoCiudad?.trim() ?? "",
      observaciones: body.observaciones?.trim() ?? "",
      creadoEn: ahora,
      enviadoEn: ahora,
    };

    await setDocument(`respuestas_invitacion_estudiante/${token}`, respuesta);
    await updateDocumentFields(`invitaciones_estudiante/${token}`, {
      estado: "enviado",
      enviadoEn: ahora,
      nombrePreliminar: nombreCompleto,
    });

    await crearNotificacionServidor({
      destinatarioUid: datosInvitacion.profesorUid,
      liceoId: datosInvitacion.liceoId,
      tipo: "formulario_recibido",
      titulo: "Formulario de Estudiante recibido",
      descripcion: `${nombreCompleto} completó el formulario de la invitación que enviaste.`,
      prioridad: "media",
      accionHref: `/dashboard/estudiantes/invitaciones/${token}`,
      accionLabel: "Revisar formulario",
    });

    await registrarEventoServidor({
      uid: `invitacion:${token}`,
      nombre: nombreCompleto,
      rol: "externo",
      liceoId: datosInvitacion.liceoId,
      accion: "formulario_enviado",
      recurso: "invitaciones_estudiante",
      recursoId: token,
      resultado: "permitido",
      detalle: `Formulario enviado por ${nombreCompleto} para la invitación generada por ${datosInvitacion.profesorNombre}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible enviar el formulario. Intenta nuevamente. (${detalle})` }, { status: 500 });
  }
}
