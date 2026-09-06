import { NextResponse } from "next/server";
import { requireCallerUid, getDocument, listCollectionDocs, setDocument } from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import type { Estudiante, Liceo, Usuario } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Cuerpo {
  estudianteId: string;
  liceoId: string;
  email: string;
}

/**
 * Crea el documento `usuarios/{uid}` para una cuenta de Estudiante,
 * vinculándola a su ficha real (`estudianteId`) — `nombre` se deriva en el
 * servidor a partir de esa ficha, nunca de lo que escriba el cliente, y se
 * verifica que el correo coincida con el registrado en ella.
 */
export async function POST(request: Request) {
  try {
    const uid = await requireCallerUid(request);
    const body = (await request.json()) as Cuerpo;
    const { estudianteId, liceoId, email } = body;
    if (!estudianteId || !liceoId || !email) {
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

    const estudianteDoc = await getDocument(`estudiantes/${estudianteId}`);
    if (!estudianteDoc) {
      return NextResponse.json({ error: "El estudiante seleccionado no existe." }, { status: 404 });
    }
    const estudiante = estudianteDoc.data as unknown as Estudiante;
    if (estudiante.liceoId !== liceoId) {
      return NextResponse.json({ error: "El estudiante seleccionado no pertenece a esa institución." }, { status: 400 });
    }
    if (estudiante.email?.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: "El correo no coincide con el registrado para este estudiante." }, { status: 400 });
    }
    if (estudiante.estado !== "activo") {
      return NextResponse.json({ error: "Este estudiante no está activo en el sistema. Contacta a tu liceo." }, { status: 403 });
    }

    const usuarios = await listCollectionDocs("usuarios");
    const yaVinculado = usuarios.some((u) => (u.data as unknown as Usuario).estudianteId === estudianteId);
    if (yaVinculado) {
      return NextResponse.json({ error: "Ya existe una cuenta creada para este estudiante." }, { status: 409 });
    }

    const nombre = `${estudiante.nombres} ${estudiante.apellidos}`.trim();
    const ahora = new Date().toISOString();
    await setDocument(`usuarios/${uid}`, {
      uid, email: email.trim(), nombre, rol: "estudiante",
      estudianteId, liceoId, activo: true, creadoEn: ahora,
    });

    await registrarEventoServidor({
      uid, nombre, rol: "estudiante", liceoId,
      accion: "cuenta_estudiante.autoregistro", recurso: "usuarios", recursoId: uid,
      resultado: "permitido", detalle: `Vinculada al estudiante ${estudianteId}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible completar la cuenta. (${detalle})` }, { status: 500 });
  }
}
