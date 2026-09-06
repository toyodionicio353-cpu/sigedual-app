import { NextResponse } from "next/server";
import { listCollectionDocs, updateDocumentFields } from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import { estaVencida } from "@/lib/demo";
import type { DemoInstancia } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Corrida diaria: pasa a "vencida" toda Demo activa cuyas 168 horas ya se
 * cumplieron. No es la única comprobación de vencimiento (cada acceso se
 * valida también en el momento, ver lib/demo/estadoEfectivo), pero deja el
 * estado guardado al día para el panel administrativo y evita depender de
 * que alguien entre a esa institución para que se note el vencimiento.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const demos = await listCollectionDocs("demos");
    const activas = demos.filter((d) => (d.data as unknown as DemoInstancia).estado === "activa");
    const vencidas = activas.filter((d) => estaVencida(d.data as unknown as DemoInstancia));

    for (const d of vencidas) {
      const demo = d.data as unknown as DemoInstancia;
      await updateDocumentFields(`demos/${d.id}`, { estado: "vencida" });
      if (demo.liceoId) {
        await updateDocumentFields(`liceos/${demo.liceoId}`, { demoEstado: "vencida" });
      }
      await registrarEventoServidor({
        uid: "cron:vencer-demos", nombre: "Vencimiento automático", rol: "externo",
        liceoId: demo.liceoId ?? "plataforma", accion: "demo.vencer", recurso: "demos", recursoId: d.id,
        resultado: "permitido",
      });
    }

    return NextResponse.json({ ok: true, revisadas: activas.length, vencidas: vencidas.length });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: detalle }, { status: 500 });
  }
}
