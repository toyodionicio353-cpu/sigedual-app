import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, updateDocumentFields, setDocument, deleteDocument, addDocument } from "@/lib/firebase-admin";
import { verificarAccesoInvitacion } from "@/lib/invitaciones/autorizacion";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import { normalizarRut } from "@/lib/rut";
import type { TipoCentroDual, EstadoCentroDual, Rol } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ValoresCentro {
  nombre: string; rut: string; tipo: TipoCentroDual; razonSocial: string; nombreComercial: string;
  direccion: string; comuna: string; ciudad: string; region: string; telefono: string; email: string;
  sitioWeb: string; contactoNombre: string; contactoCargo: string; contactoTelefono: string; contactoEmail: string;
  capacidad: string; estado: EstadoCentroDual;
}

interface CuerpoAutorellenar {
  centroDualIdExistente?: string;
  valores: ValoresCentro;
  especialidades: string[];
  areas: string[];
  caracteristicas: string[];
  habilidades: string[];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; respuestaId: string }> }) {
  const { id, respuestaId } = await params;
  try {
    const uid = await requireCallerUid(request);
    const campania = await getDocument(`campanias_invitacion/${id}`);
    if (!campania) {
      return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
    }
    const datosCampania = campania.data as { liceoId: string; profesorUid: string };
    if (!(await verificarAccesoInvitacion(uid, datosCampania))) {
      return NextResponse.json({ error: "No autorizado para procesar esta campaña." }, { status: 403 });
    }

    const respuesta = await getDocument(`respuestas_campania/${respuestaId}`);
    if (!respuesta || respuesta.data.campaniaId !== id) {
      return NextResponse.json({ error: "Respuesta no encontrada." }, { status: 404 });
    }
    if (respuesta.data.estado === "traspasado") {
      return NextResponse.json({ error: "Esta respuesta ya fue traspasada anteriormente." }, { status: 409 });
    }

    const body = (await request.json()) as CuerpoAutorellenar;
    const v = body.valores;
    if (!v?.nombre?.trim()) {
      return NextResponse.json({ error: "El nombre del centro es obligatorio." }, { status: 400 });
    }

    const rutNuevo = v.rut?.trim() ? normalizarRut(v.rut) : "";
    const ahora = new Date().toISOString();
    const datosCentro: Record<string, unknown> = {
      nombre: v.nombre.trim(),
      rut: rutNuevo,
      tipo: v.tipo,
      razonSocial: v.razonSocial?.trim() ?? "",
      nombreComercial: v.nombreComercial?.trim() ?? "",
      direccion: v.direccion?.trim() ?? "",
      comuna: v.comuna?.trim() ?? "",
      ciudad: v.ciudad?.trim() ?? "",
      region: v.region?.trim() ?? "",
      telefono: v.telefono?.trim() ?? "",
      email: v.email?.trim() ?? "",
      sitioWeb: v.sitioWeb?.trim() ?? "",
      contactoNombre: v.contactoNombre?.trim() ?? "",
      contactoCargo: v.contactoCargo?.trim() ?? "",
      contactoTelefono: v.contactoTelefono?.trim() ?? "",
      contactoEmail: v.contactoEmail?.trim() ?? "",
      liceoId: datosCampania.liceoId,
      especialidades: body.especialidades ?? [],
      areasDesempeno: body.areas ?? [],
      caracteristicas: body.caracteristicas ?? [],
      habilidadesValoradas: body.habilidades ?? [],
      capacidad: v.capacidad?.trim() ? Number(v.capacidad) : undefined,
      estado: v.estado,
      activo: v.estado === "activo",
    };

    let centroDualId: string;
    try {
      let rutAnterior = "";
      if (body.centroDualIdExistente) {
        centroDualId = body.centroDualIdExistente;
        const existente = await getDocument(`centros_duales/${centroDualId}`);
        rutAnterior = existente?.data.rut ? normalizarRut(existente.data.rut as string) : "";
        await updateDocumentFields(`centros_duales/${centroDualId}`, { ...datosCentro, actualizadoEn: ahora });
      } else {
        centroDualId = await addDocument("centros_duales", { ...datosCentro, creadoEn: ahora, creadoPor: datosCampania.profesorUid });
      }

      if (rutAnterior && rutAnterior !== rutNuevo) {
        await deleteDocument(`centros_duales_por_rut/${rutAnterior}`);
      }
      if (rutNuevo) {
        await setDocument(`centros_duales_por_rut/${rutNuevo}`, { centroDualId, liceoId: datosCampania.liceoId });
      }

      await setDocument(`autorizaciones/${datosCampania.profesorUid}_centro_${centroDualId}`, {
        profesorUid: datosCampania.profesorUid,
        tipo: "centro",
        recursoId: centroDualId,
        liceoId: datosCampania.liceoId,
        origen: "invitacion",
        invitacionId: id,
        creadoEn: ahora,
      });
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      await updateDocumentFields(`respuestas_campania/${respuestaId}`, { estado: "error", errorDetalle: detalle });
      return NextResponse.json({ error: `No fue posible guardar el centro: ${detalle}` }, { status: 500 });
    }

    await updateDocumentFields(`respuestas_campania/${respuestaId}`, {
      estado: "traspasado",
      procesadoEn: ahora,
      centroDualIdResultado: centroDualId,
    });

    const usuarioDoc = await getDocument(`usuarios/${uid}`);
    await registrarEventoServidor({
      uid,
      nombre: (usuarioDoc?.data.nombre as string) ?? uid,
      rol: (usuarioDoc?.data.rol as Rol) ?? "profesor",
      liceoId: datosCampania.liceoId,
      accion: "autorellenar_centro",
      recurso: "centros_duales",
      recursoId: centroDualId,
      resultado: "permitido",
      detalle: `Autorrellenado desde la campaña ${id} (respuesta ${respuestaId})${body.centroDualIdExistente ? " (actualizó un centro existente)" : " (creó un centro nuevo)"}.`,
    });

    return NextResponse.json({ ok: true, centroDualId });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    const noAutorizado = detalle.startsWith("No autorizado");
    return NextResponse.json({ error: detalle }, { status: noAutorizado ? 403 : 500 });
  }
}
