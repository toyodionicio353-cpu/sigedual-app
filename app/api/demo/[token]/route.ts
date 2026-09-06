import { NextResponse } from "next/server";
import { getDocument } from "@/lib/firebase-admin";
import { estadoEfectivo } from "@/lib/demo";
import type { DemoInstancia } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Validación pública del enlace de demostración (sin sesión). Devuelve solo
 * lo necesario para la pantalla pública — nunca el listado completo ni
 * datos de otras demos. La validación real de vencimiento se hace acá
 * comparando contra `venceEn` guardado en el servidor, no contra el reloj
 * del dispositivo de quien consulta.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const doc = await getDocument(`demos/${token}`);
    if (!doc) {
      return NextResponse.json({ error: "Este enlace de demostración no existe." }, { status: 404 });
    }
    const demo = doc.data as unknown as DemoInstancia;
    const estado = estadoEfectivo(demo);

    if (demo.liceoId) {
      return NextResponse.json({
        ok: true, reclamada: true, estado, liceoNombre: demo.liceoNombre ?? null,
      });
    }
    if (estado !== "activa") {
      return NextResponse.json({ ok: false, reclamada: false, estado }, { status: 410 });
    }
    return NextResponse.json({ ok: true, reclamada: false, estado, venceEn: demo.venceEn });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible validar el enlace. Intenta nuevamente. (${detalle})` }, { status: 500 });
  }
}
