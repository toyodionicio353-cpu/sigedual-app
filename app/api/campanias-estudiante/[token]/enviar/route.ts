import { NextResponse } from "next/server";
import { getDocumentConVersion, commitTransaccional, esConflictoDeEscritura } from "@/lib/firebase-admin";
import { crearNotificacionServidor } from "@/lib/notificaciones/crearNotificacion";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import { validarRut } from "@/lib/rut";
import type { EstadoCampania, RespuestaCampaniaEstudiante } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CuerpoEnvio = Omit<RespuestaCampaniaEstudiante, "id" | "campaniaId" | "liceoId" | "numero" | "estado" | "creadoEn" | "enviadoEn">;

const MAX_REINTENTOS = 5;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
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

    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      const campania = await getDocumentConVersion(`campanias_invitacion_estudiante/${token}`);
      if (!campania) {
        return NextResponse.json({ error: "Este enlace no es válido." }, { status: 404 });
      }
      const datos = campania.data as {
        estado: EstadoCampania; liceoId: string; profesorUid: string; profesorNombre: string;
        capacidad: number; respuestasCount: number; expiraEn?: string;
      };

      if (datos.estado === "revocada") {
        return NextResponse.json({ error: "Este formulario fue revocado por el liceo." }, { status: 410 });
      }
      if (datos.expiraEn && new Date(datos.expiraEn) < new Date()) {
        return NextResponse.json({ error: "Este formulario ya no está disponible." }, { status: 410 });
      }
      if (datos.estado === "completa" || datos.respuestasCount >= datos.capacidad) {
        return NextResponse.json({ error: "Ya no se aceptan respuestas para este formulario — se alcanzó el cupo máximo." }, { status: 409 });
      }

      const ahora = new Date().toISOString();
      const numero = datos.respuestasCount + 1;
      const nombreCompleto = `${body.nombres.trim()} ${body.apellidoPaterno.trim()}`.trim();
      const respuestaId = crypto.randomUUID();
      const respuesta: Omit<RespuestaCampaniaEstudiante, "id"> = {
        campaniaId: token,
        liceoId: datos.liceoId,
        numero,
        estado: "recibido",
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

      try {
        await commitTransaccional([
          {
            tipo: "update",
            path: `campanias_invitacion_estudiante/${token}`,
            data: {
              respuestasCount: numero,
              ...(numero >= datos.capacidad ? { estado: "completa" } : {}),
            },
            updateTime: campania.updateTime,
          },
          { tipo: "create", path: `respuestas_campania_estudiante/${respuestaId}`, data: respuesta },
        ]);
      } catch (err) {
        if (esConflictoDeEscritura(err) && intento < MAX_REINTENTOS - 1) continue;
        throw err;
      }

      await crearNotificacionServidor({
        destinatarioUid: datos.profesorUid,
        liceoId: datos.liceoId,
        tipo: "formulario_recibido",
        titulo: "Formulario de Estudiante recibido (masivo)",
        descripcion: `${nombreCompleto} completó el formulario #${numero} de tu campaña.`,
        prioridad: "media",
        accionHref: `/dashboard/estudiantes/campanias/${token}`,
        accionLabel: "Revisar formularios",
      });

      await registrarEventoServidor({
        uid: `campania:${token}`,
        nombre: nombreCompleto,
        rol: "externo",
        liceoId: datos.liceoId,
        accion: "formulario_enviado",
        recurso: "respuestas_campania_estudiante",
        recursoId: respuestaId,
        resultado: "permitido",
        detalle: `Formulario #${numero} enviado por ${nombreCompleto} para la campaña "${token}" generada por ${datos.profesorNombre}.`,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ya no se aceptan respuestas para este formulario — se alcanzó el cupo máximo." }, { status: 409 });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible enviar el formulario. Intenta nuevamente. (${detalle})` }, { status: 500 });
  }
}
