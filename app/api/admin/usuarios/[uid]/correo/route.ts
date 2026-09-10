import { NextResponse } from "next/server";
import {
  requireAdmin, setAuthUserEmail, getDocument, updateDocumentFields,
} from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import type { Rol } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Validación deliberadamente simple: quien decide de verdad si el correo
 * sirve es Firebase Auth, que ya rechaza los formatos inválidos. Acá solo
 * se descarta lo obvio antes de gastar una llamada. */
function correoValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Cambia el correo de una cuenta. Solo el rol desarrollador (lo verifica
 * `requireAdmin`), porque el correo es la credencial de inicio de sesión:
 * cambiarlo decide con qué dirección entra esa persona a partir de ahora.
 *
 * Pasa por el servidor y no por el cliente porque el SDK del navegador solo
 * puede cambiar el correo de la sesión activa — nunca el de otra cuenta.
 */
export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;

  try {
    const solicitanteUid = await requireAdmin(request);

    const body = (await request.json()) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return NextResponse.json({ error: "Falta el correo." }, { status: 400 });
    if (!correoValido(email)) {
      return NextResponse.json({ error: "El correo no tiene un formato válido." }, { status: 400 });
    }

    const ficha = await getDocument(`usuarios/${uid}`);
    if (!ficha) {
      return NextResponse.json({ error: "No existe la ficha de ese usuario." }, { status: 404 });
    }
    const anterior = typeof ficha.data.email === "string" ? ficha.data.email : "";
    if (anterior.toLowerCase() === email) {
      return NextResponse.json({ ok: true, email, sinCambios: true });
    }

    // Primero Auth: si falla (correo duplicado, formato), la ficha queda
    // intacta y no se produce el desajuste de que Firestore muestre un
    // correo con el que en realidad no se puede iniciar sesión.
    await setAuthUserEmail(uid, email);
    await updateDocumentFields(`usuarios/${uid}`, { email, actualizadoEn: new Date().toISOString() });

    const solicitante = await getDocument(`usuarios/${solicitanteUid}`);
    await registrarEventoServidor({
      uid: solicitanteUid,
      nombre: (solicitante?.data.nombre as string) ?? "",
      rol: ((solicitante?.data.rol as Rol) ?? "desarrollador"),
      liceoId: (solicitante?.data.liceoId as string) ?? "",
      accion: "cambiar_correo_usuario",
      recurso: "usuarios",
      recursoId: uid,
      resultado: "permitido",
      detalle: `${anterior || "(sin correo)"} → ${email}`,
    });

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado al cambiar el correo.";
    const noAutorizado = mensaje.startsWith("No autorizado");
    return NextResponse.json({ error: mensaje }, { status: noAutorizado ? 403 : 500 });
  }
}
