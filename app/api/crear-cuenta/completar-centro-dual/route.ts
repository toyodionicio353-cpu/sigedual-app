import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, listCollectionDocs, setDocument } from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import type { MaestroGuia } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Cuerpo {
  maestroGuiaId: string;
  liceoId: string;
  email: string;
}

/**
 * Crea el documento `usuarios/{uid}` para una cuenta Centro Dual/Maestro
 * Guía autoregistrada, derivando `centroDualId` y `nombre` en el servidor
 * a partir del Maestro Guía real — nunca de lo que envíe el cliente. Así
 * se evita que una cuenta quede sin vínculo (el bug original) y también
 * que alguien fuerce un `centroDualId` distinto al de su propio Maestro
 * Guía, lo que rompería el aislamiento entre centros duales.
 */
export async function POST(request: Request) {
  try {
    const uid = await requireCallerUid(request);
    const body = (await request.json()) as Cuerpo;
    const { maestroGuiaId, liceoId, email } = body;
    if (!maestroGuiaId || !liceoId || !email) {
      return NextResponse.json({ error: "Faltan datos para completar la cuenta." }, { status: 400 });
    }

    const yaExiste = await getDocument(`usuarios/${uid}`);
    if (yaExiste) {
      return NextResponse.json({ error: "Esta cuenta ya fue creada." }, { status: 409 });
    }

    const mgDoc = await getDocument(`maestros_guia/${maestroGuiaId}`);
    if (!mgDoc) {
      return NextResponse.json({ error: "El Maestro Guía seleccionado no existe." }, { status: 404 });
    }
    const mg = mgDoc.data as unknown as MaestroGuia;
    if (mg.liceoId !== liceoId) {
      return NextResponse.json({ error: "El Maestro Guía seleccionado no pertenece a tu institución." }, { status: 400 });
    }

    const usuarios = await listCollectionDocs("usuarios");
    const yaVinculado = usuarios.some((u) => (u.data as { maestroGuiaId?: string }).maestroGuiaId === maestroGuiaId);
    if (yaVinculado) {
      return NextResponse.json({ error: "Ya existe una cuenta creada para este Maestro Guía." }, { status: 409 });
    }

    const nombre = `${mg.nombres} ${mg.apellidoPaterno} ${mg.apellidoMaterno ?? ""}`.trim();
    const ahora = new Date().toISOString();
    await setDocument(`usuarios/${uid}`, {
      uid, email: email.trim(), nombre, rol: "centro_dual",
      maestroGuiaId, centroDualId: mg.centroDualId, liceoId,
      activo: true, creadoEn: ahora,
    });

    await registrarEventoServidor({
      uid, nombre, rol: "centro_dual", liceoId,
      accion: "cuenta_centro_dual.autoregistro", recurso: "usuarios", recursoId: uid,
      resultado: "permitido", detalle: `Vinculada a Maestro Guía ${maestroGuiaId} (Centro Dual ${mg.centroDualId}).`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible completar la cuenta. (${detalle})` }, { status: 500 });
  }
}
