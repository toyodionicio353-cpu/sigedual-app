import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, listCollectionDocs, setDocument } from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import type { CentroDual, Liceo, Usuario } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Cuerpo {
  centroDualId: string;
  liceoId: string;
  email: string;
}

/**
 * Crea el documento `usuarios/{uid}` para una cuenta Centro Dual "de
 * empresa" (a diferencia de "Crear acceso" en la ficha de Maestro Guía,
 * que crea una cuenta de UNA persona puntual): esta cuenta ve todo lo de
 * su Centro Dual. `centroDualId` y `nombre` se derivan en el servidor a
 * partir del Centro Dual real — nunca de lo que envíe el cliente — y se
 * verifica que el correo coincida con el registrado en su ficha.
 */
export async function POST(request: Request) {
  try {
    const uid = await requireCallerUid(request);
    const body = (await request.json()) as Cuerpo;
    const { centroDualId, liceoId, email } = body;
    if (!centroDualId || !liceoId || !email) {
      return NextResponse.json({ error: "Faltan datos para completar la cuenta." }, { status: 400 });
    }

    const yaExiste = await getDocument(`usuarios/${uid}`);
    if (yaExiste) {
      return NextResponse.json({ error: "Esta cuenta ya fue creada." }, { status: 409 });
    }

    const liceoDoc = await getDocument(`liceos/${liceoId}`);
    const liceo = liceoDoc?.data as unknown as Liceo | undefined;
    if (!liceoDoc || (liceo?.estado ?? "activo") === "inactivo") {
      return NextResponse.json({ error: "Esta institución no está disponible." }, { status: 404 });
    }

    const centroDoc = await getDocument(`centros_duales/${centroDualId}`);
    if (!centroDoc) {
      return NextResponse.json({ error: "El Centro Dual seleccionado no existe." }, { status: 404 });
    }
    const centro = centroDoc.data as unknown as CentroDual;
    if (centro.liceoId !== liceoId) {
      return NextResponse.json({ error: "El Centro Dual seleccionado no pertenece a esa institución." }, { status: 400 });
    }
    if (centro.email?.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: "El correo no coincide con el registrado para este Centro Dual." }, { status: 400 });
    }
    if (centro.estado === "inactivo") {
      return NextResponse.json({ error: "Este Centro Dual está inactivo. Contacta a tu liceo." }, { status: 403 });
    }

    const usuarios = await listCollectionDocs("usuarios");
    const yaVinculado = usuarios.some((u) => {
      const usr = u.data as unknown as Usuario;
      return usr.centroDualId === centroDualId && !usr.maestroGuiaId;
    });
    if (yaVinculado) {
      return NextResponse.json({ error: "Ya existe una cuenta creada para este Centro Dual." }, { status: 409 });
    }

    const nombre = centro.contactoNombre?.trim() || centro.nombre;
    const ahora = new Date().toISOString();
    await setDocument(`usuarios/${uid}`, {
      uid, email: email.trim(), nombre, rol: "centro_dual",
      centroDualId, liceoId, activo: true, creadoEn: ahora,
    });

    await registrarEventoServidor({
      uid, nombre, rol: "centro_dual", liceoId,
      accion: "cuenta_centro_dual.autoregistro_empresa", recurso: "usuarios", recursoId: uid,
      resultado: "permitido", detalle: `Vinculada al Centro Dual ${centroDualId} (cuenta a nivel de empresa).`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible completar la cuenta. (${detalle})` }, { status: 500 });
  }
}
