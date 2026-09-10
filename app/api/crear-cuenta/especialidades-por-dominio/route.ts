import { NextResponse } from "next/server";
import { listCollectionDocs } from "@/lib/firebase-admin";
import type { Liceo, Especialidad } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista las especialidades del liceo cuyo dominio de correo coincide —
 * usada en /crear-cuenta para que un Profesor Supervisor elija su
 * especialidad al registrarse, igual que ya elige un administrador al
 * crearlo desde "Agregar profesor". Sin sesión todavía (el usuario recién
 * se está registrando), por eso pasa por firebase-admin en vez de la regla
 * normal de `especialidades` (que exige estar autenticado).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dominio = url.searchParams.get("dominio")?.trim().toLowerCase() ?? "";
    if (!dominio) {
      return NextResponse.json({ error: "Falta el dominio." }, { status: 400 });
    }

    const liceos = await listCollectionDocs("liceos");
    const liceo = liceos.find((l) => {
      const data = l.data as unknown as Liceo;
      return data.dominioCorreo?.trim().toLowerCase() === dominio;
    });
    if (!liceo) {
      return NextResponse.json({ especialidades: [] });
    }
    const liceoData = liceo.data as unknown as Liceo;
    if ((liceoData.estado ?? "activo") === "inactivo") {
      return NextResponse.json({ especialidades: [] });
    }

    const especialidades = await listCollectionDocs("especialidades");
    const delLiceo = especialidades
      .map((e) => ({ ...(e.data as unknown as Especialidad), id: e.id }))
      .filter((e) => e.liceoId === liceo.id && e.estado !== "inactiva")
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((e) => ({ id: e.id, nombre: e.nombre }));

    return NextResponse.json({ especialidades: delLiceo });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible cargar las especialidades. (${detalle})` }, { status: 500 });
  }
}
