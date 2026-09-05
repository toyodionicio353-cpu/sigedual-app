import { NextResponse } from "next/server";
import { getDocumentConVersion, commitTransaccional, esConflictoDeEscritura } from "@/lib/firebase-admin";
import { crearNotificacionServidor } from "@/lib/notificaciones/crearNotificacion";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import type { EstadoCampania, RespuestaCampaniaEmpresa, RespuestaMaestroGuiaInvitacion } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CuerpoEnvio {
  empresa: RespuestaCampaniaEmpresa["empresa"];
  perfil: RespuestaCampaniaEmpresa["perfil"];
  necesidades: RespuestaCampaniaEmpresa["necesidades"];
  caracteristicas: RespuestaCampaniaEmpresa["caracteristicas"];
  capacidad: RespuestaCampaniaEmpresa["capacidad"];
  maestrosGuia: Omit<RespuestaMaestroGuiaInvitacion, "id">[];
}

const MAX_REINTENTOS = 5;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = (await request.json()) as CuerpoEnvio;

    const razonSocial = body.empresa?.razonSocial?.trim();
    if (!razonSocial) {
      return NextResponse.json({ error: "El nombre de la empresa es obligatorio." }, { status: 400 });
    }
    const maestrosValidos = (body.maestrosGuia ?? []).filter((m) => m.nombres?.trim());
    if (maestrosValidos.length === 0) {
      return NextResponse.json({ error: "Debes ingresar al menos un Maestro Guía." }, { status: 400 });
    }

    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      const campania = await getDocumentConVersion(`campanias_invitacion/${token}`);
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
      const respuestaId = crypto.randomUUID();
      const respuesta: Omit<RespuestaCampaniaEmpresa, "id"> = {
        campaniaId: token,
        liceoId: datos.liceoId,
        numero,
        estado: "recibido",
        empresa: body.empresa ?? {},
        perfil: body.perfil ?? {},
        necesidades: body.necesidades ?? {},
        caracteristicas: body.caracteristicas ?? {},
        capacidad: body.capacidad ?? {},
        maestrosGuia: maestrosValidos.map((m) => ({ ...m, id: crypto.randomUUID() })),
        creadoEn: ahora,
        enviadoEn: ahora,
      };

      try {
        await commitTransaccional([
          {
            tipo: "update",
            path: `campanias_invitacion/${token}`,
            data: {
              respuestasCount: numero,
              ...(numero >= datos.capacidad ? { estado: "completa" } : {}),
            },
            updateTime: campania.updateTime,
          },
          { tipo: "create", path: `respuestas_campania/${respuestaId}`, data: respuesta },
        ]);
      } catch (err) {
        if (esConflictoDeEscritura(err) && intento < MAX_REINTENTOS - 1) continue;
        throw err;
      }

      await crearNotificacionServidor({
        destinatarioUid: datos.profesorUid,
        liceoId: datos.liceoId,
        tipo: "formulario_recibido",
        titulo: "Formulario de Empresa Dual recibido (masivo)",
        descripcion: `${razonSocial} completó el formulario #${numero} de tu campaña.`,
        prioridad: "media",
        accionHref: `/dashboard/centros/campanias/${token}`,
        accionLabel: "Revisar formularios",
      });

      await registrarEventoServidor({
        uid: `campania:${token}`,
        nombre: razonSocial,
        rol: "externo",
        liceoId: datos.liceoId,
        accion: "formulario_enviado",
        recurso: "respuestas_campania",
        recursoId: respuestaId,
        resultado: "permitido",
        detalle: `Formulario #${numero} enviado por ${razonSocial} para la campaña "${token}" generada por ${datos.profesorNombre}.`,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ya no se aceptan respuestas para este formulario — se alcanzó el cupo máximo." }, { status: 409 });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible enviar el formulario. Intenta nuevamente. (${detalle})` }, { status: 500 });
  }
}
