import { NextResponse } from "next/server";
import { listCollectionDocs } from "@/lib/firebase-admin";
import type { Estudiante } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirma que el correo ingresado corresponde a un Estudiante ya
 * registrado en el liceo elegido (el mismo correo que se ingresó en su
 * ficha/formulario) — así nadie puede crear una cuenta de estudiante sin
 * existir como tal. Sin sesión todavía, por eso pasa por firebase-admin.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const liceoId = url.searchParams.get("liceoId")?.trim() ?? "";
    const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    if (!liceoId || !email) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    const estudiantes = await listCollectionDocs("estudiantes");
    const encontrado = estudiantes.find((e) => {
      const est = e.data as unknown as Estudiante;
      return est.liceoId === liceoId && est.email?.trim().toLowerCase() === email;
    });
    if (!encontrado) {
      return NextResponse.json({ error: "Este correo no corresponde a ningún estudiante registrado en esa institución." }, { status: 404 });
    }
    const est = encontrado.data as unknown as Estudiante;

    return NextResponse.json({ ok: true, estudianteId: encontrado.id, nombre: `${est.nombres} ${est.apellidos}`.trim() });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible verificar el estudiante. (${detalle})` }, { status: 500 });
  }
}
