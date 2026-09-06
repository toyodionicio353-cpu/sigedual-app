import { NextResponse } from "next/server";
import { getDocumentConVersion, commitTransaccional, esConflictoDeEscritura } from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import { estadoEfectivo } from "@/lib/demo";
import type { DemoInstancia, Liceo } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CuerpoReclamo {
  nombreInstitucion: string;
  comuna: string;
  region: string;
  email: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reclama un enlace de demostración: crea el Liceo de la institución y
 * marca la demo como usada, en un solo commit atómico (si dos personas
 * abren el mismo enlace a la vez, solo una gana — la otra recibe 409 y no
 * queda ningún liceo a medio crear). No crea la cuenta del director: eso
 * lo hace el propio navegador con el SDK de Firebase Auth (igual que
 * /crear-cuenta), y recién con ese uid ya autenticado escribe su propio
 * documento en `usuarios` — el mismo orden evita cuentas de Auth huérfanas
 * si el reclamo del liceo falla.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = (await request.json()) as CuerpoReclamo;
    const nombreInstitucion = body.nombreInstitucion?.trim();
    const comuna = body.comuna?.trim();
    const region = body.region?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!nombreInstitucion) return NextResponse.json({ error: "El nombre de la institución es obligatorio." }, { status: 400 });
    if (!comuna) return NextResponse.json({ error: "La comuna es obligatoria." }, { status: 400 });
    if (!region) return NextResponse.json({ error: "La región es obligatoria." }, { status: 400 });
    if (!email || !EMAIL_REGEX.test(email)) return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });

    const demoDoc = await getDocumentConVersion(`demos/${token}`);
    if (!demoDoc) return NextResponse.json({ error: "Este enlace de demostración no existe." }, { status: 404 });

    const demo = demoDoc.data as unknown as DemoInstancia;
    if (demo.liceoId) {
      return NextResponse.json({ error: "Este enlace de demostración ya fue utilizado por otra institución." }, { status: 409 });
    }
    const estado = estadoEfectivo(demo);
    if (estado !== "activa") {
      const motivo = estado === "vencida" ? "ya venció" : "fue cancelado";
      return NextResponse.json({ error: `Este enlace de demostración ${motivo}.` }, { status: 410 });
    }

    const liceoId = crypto.randomUUID();
    const ahora = new Date().toISOString();
    const dominioCorreo = email.split("@")[1];

    const liceo: Omit<Liceo, "id"> = {
      nombre: nombreInstitucion,
      rbd: "",
      comuna,
      region,
      direccion: "",
      dominioCorreo,
      estado: "activo",
      esDemo: true,
      demoId: token,
      demoVenceEn: demo.venceEn,
      demoEstado: "activa",
      planEstado: "demo",
      creadoEn: ahora,
      actualizadoEn: ahora,
    };

    await commitTransaccional([
      { tipo: "create", path: `liceos/${liceoId}`, data: liceo },
      {
        tipo: "update", path: `demos/${token}`, updateTime: demoDoc.updateTime,
        data: { liceoId, liceoNombre: nombreInstitucion, reclamadoEn: ahora },
      },
    ]);

    await registrarEventoServidor({
      uid: `demo:${token}`, nombre: nombreInstitucion, rol: "externo",
      liceoId, accion: "demo.reclamar", recurso: "demos", recursoId: token, resultado: "permitido",
    });

    return NextResponse.json({ ok: true, liceoId, liceoNombre: nombreInstitucion });
  } catch (err) {
    if (esConflictoDeEscritura(err)) {
      return NextResponse.json({ error: "Este enlace de demostración ya fue utilizado por otra institución." }, { status: 409 });
    }
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible registrar la institución. Intenta nuevamente. (${detalle})` }, { status: 500 });
  }
}
