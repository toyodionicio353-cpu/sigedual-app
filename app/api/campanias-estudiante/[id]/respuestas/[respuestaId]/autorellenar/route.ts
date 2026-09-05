import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, updateDocumentFields, setDocument, deleteDocument, addDocument } from "@/lib/firebase-admin";
import { verificarAccesoInvitacion } from "@/lib/invitaciones/autorizacion";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import { normalizarRut } from "@/lib/rut";
import type { Estudiante, Rol } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ValoresEstudiante {
  run: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string;
  fechaNacimiento: string; sexo: string; nacionalidad: string;
  email: string; telefono: string; direccion: string; comuna: string; ciudad: string;
  anioAcademico: string; nivel: string; curso: string; especialidadId: string; jornada: string;
  estado: Estudiante["estado"];
  enfermedadesCronicas: string; alergias: string;
  apoderadoNombre: string; apoderadoRun: string; apoderadoParentesco: string;
  apoderadoTelefono: string; apoderadoEmail: string; apoderadoDomicilio: string; apoderadoCiudad: string;
  observaciones: string;
}

interface CuerpoAutorellenar {
  estudianteIdExistente?: string;
  valores: ValoresEstudiante;
  otrosMedicos: string[];
  rasgos: string[];
  habilidades: string[];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; respuestaId: string }> }) {
  const { id, respuestaId } = await params;
  try {
    const uid = await requireCallerUid(request);
    const campania = await getDocument(`campanias_invitacion_estudiante/${id}`);
    if (!campania) {
      return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    }
    const datosCampania = campania.data as { liceoId: string; profesorUid: string };
    if (!(await verificarAccesoInvitacion(uid, datosCampania))) {
      return NextResponse.json({ error: "No autorizado para procesar esta campaña." }, { status: 403 });
    }

    const respuesta = await getDocument(`respuestas_campania_estudiante/${respuestaId}`);
    if (!respuesta || respuesta.data.campaniaId !== id) {
      return NextResponse.json({ error: "Respuesta no encontrada." }, { status: 404 });
    }
    if (respuesta.data.estado === "traspasado") {
      return NextResponse.json({ error: "Esta respuesta ya fue traspasada anteriormente." }, { status: 409 });
    }

    const body = (await request.json()) as CuerpoAutorellenar;
    const v = body.valores;
    if (!v?.nombres?.trim() || !v?.apellidoPaterno?.trim()) {
      return NextResponse.json({ error: "El nombre y apellido paterno del estudiante son obligatorios." }, { status: 400 });
    }

    const runNuevo = v.run?.trim() ? normalizarRut(v.run) : "";
    const ahora = new Date().toISOString();
    const datosEstudiante: Record<string, unknown> = {
      run: runNuevo,
      nombres: v.nombres.trim(),
      apellidos: `${v.apellidoPaterno.trim()} ${v.apellidoMaterno?.trim() ?? ""}`.trim(),
      apellidoPaterno: v.apellidoPaterno.trim(),
      apellidoMaterno: v.apellidoMaterno?.trim() ?? "",
      fechaNacimiento: v.fechaNacimiento ?? "",
      sexo: v.sexo ?? "",
      nacionalidad: v.nacionalidad?.trim() ?? "",
      email: v.email?.trim() ?? "",
      telefono: v.telefono?.trim() ?? "",
      direccion: v.direccion?.trim() ?? "",
      comuna: v.comuna?.trim() ?? "",
      ciudad: v.ciudad?.trim() ?? "",
      anioAcademico: v.anioAcademico?.trim() ?? "",
      nivel: v.nivel ?? "",
      curso: v.curso?.trim() ?? "",
      especialidadId: v.especialidadId ?? "",
      jornada: v.jornada ?? "",
      liceoId: datosCampania.liceoId,
      profesorId: datosCampania.profesorUid,
      estado: v.estado || "activo",
      enfermedadesCronicas: v.enfermedadesCronicas?.trim() ?? "",
      alergias: v.alergias?.trim() ?? "",
      informacionMedicaAdicional: (body.otrosMedicos ?? []).map((s) => s.trim()).filter(Boolean),
      rasgos: body.rasgos ?? [],
      habilidades: body.habilidades ?? [],
      apoderadoNombre: v.apoderadoNombre?.trim() ?? "",
      apoderadoRun: v.apoderadoRun?.trim() ? normalizarRut(v.apoderadoRun) : "",
      apoderadoParentesco: v.apoderadoParentesco ?? "",
      apoderadoTelefono: v.apoderadoTelefono?.trim() ?? "",
      apoderadoEmail: v.apoderadoEmail?.trim() ?? "",
      apoderadoDomicilio: v.apoderadoDomicilio?.trim() ?? "",
      apoderadoCiudad: v.apoderadoCiudad?.trim() ?? "",
      observaciones: v.observaciones?.trim() ?? "",
    };

    let estudianteId: string;
    let runAnterior = "";
    try {
      if (body.estudianteIdExistente) {
        estudianteId = body.estudianteIdExistente;
        const existente = await getDocument(`estudiantes/${estudianteId}`);
        runAnterior = existente?.data.run ? normalizarRut(existente.data.run as string) : "";
        await updateDocumentFields(`estudiantes/${estudianteId}`, { ...datosEstudiante, actualizadoEn: ahora });
      } else {
        estudianteId = await addDocument("estudiantes", { ...datosEstudiante, creadoEn: ahora });
      }

      if (runAnterior && runAnterior !== runNuevo) {
        await deleteDocument(`estudiantes_por_run/${runAnterior}`);
      }
      if (runNuevo) {
        await setDocument(`estudiantes_por_run/${runNuevo}`, { estudianteId, liceoId: datosCampania.liceoId });
      }

      await setDocument(`autorizaciones/${datosCampania.profesorUid}_estudiante_${estudianteId}`, {
        profesorUid: datosCampania.profesorUid,
        tipo: "estudiante",
        recursoId: estudianteId,
        liceoId: datosCampania.liceoId,
        origen: "invitacion",
        invitacionId: id,
        creadoEn: ahora,
      });
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      await updateDocumentFields(`respuestas_campania_estudiante/${respuestaId}`, { estado: "error", errorDetalle: detalle });
      return NextResponse.json({ error: `No fue posible guardar el estudiante: ${detalle}` }, { status: 500 });
    }

    await updateDocumentFields(`respuestas_campania_estudiante/${respuestaId}`, {
      estado: "traspasado",
      procesadoEn: ahora,
      estudianteIdResultado: estudianteId,
    });

    const usuarioDoc = await getDocument(`usuarios/${uid}`);
    await registrarEventoServidor({
      uid,
      nombre: (usuarioDoc?.data.nombre as string) ?? uid,
      rol: (usuarioDoc?.data.rol as Rol) ?? "profesor",
      liceoId: datosCampania.liceoId,
      accion: "autorellenar_estudiante",
      recurso: "estudiantes",
      recursoId: estudianteId,
      resultado: "permitido",
      detalle: `Autorrellenado desde la campaña ${id} (respuesta ${respuestaId})${body.estudianteIdExistente ? " (actualizó un estudiante existente)" : " (creó un estudiante nuevo)"}.`,
    });

    return NextResponse.json({ ok: true, estudianteId });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    const noAutorizado = detalle.startsWith("No autorizado");
    return NextResponse.json({ error: detalle }, { status: noAutorizado ? 403 : 500 });
  }
}
