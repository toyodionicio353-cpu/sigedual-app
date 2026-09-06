import { NextResponse } from "next/server";
import { listCollectionDocs } from "@/lib/firebase-admin";
import type { CentroDual } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirma que el correo ingresado corresponde a un Centro Dual ya
 * registrado en el liceo elegido — así una empresa no puede "inventar" una
 * cuenta: debe existir su ficha, con ese mismo correo. Sin sesión todavía
 * (por eso pasa por firebase-admin en vez de una lectura directa desde el
 * cliente: `centros_duales` no es de lectura pública).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const liceoId = url.searchParams.get("liceoId")?.trim() ?? "";
    const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    if (!liceoId || !email) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    const centros = await listCollectionDocs("centros_duales");
    const encontrado = centros.find((c) => {
      const centro = c.data as unknown as CentroDual;
      return centro.liceoId === liceoId && centro.email?.trim().toLowerCase() === email;
    });
    if (!encontrado) {
      return NextResponse.json({ error: "Este correo no corresponde a ningún Centro Dual registrado en esa institución." }, { status: 404 });
    }
    const centro = encontrado.data as unknown as CentroDual;

    return NextResponse.json({ ok: true, centroDualId: encontrado.id, nombre: centro.contactoNombre?.trim() || centro.nombre });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible verificar el Centro Dual. (${detalle})` }, { status: 500 });
  }
}
