import { NextResponse } from "next/server";
import { listCollectionDocs } from "@/lib/firebase-admin";
import type { CentroDual, CodigoAcceso, MaestroGuia } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista los Maestros Guía activos del liceo identificado por el código
 * "para Estudiantes y Centros Duales" (Configuración → Seguridad, distinto
 * del código de Profesor Supervisor/Coordinador) — para poblar el selector
 * "Centro Dual / Maestro Guía" en /crear-cuenta. Una empresa Centro Dual no
 * usa el dominio de correo del liceo, así que el código es lo único que
 * identifica a qué institución pertenece, sin sesión todavía.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const codigo = url.searchParams.get("codigo")?.trim().toUpperCase() ?? "";
    if (!codigo) {
      return NextResponse.json({ error: "Ingresa el código entregado por tu profesor supervisor." }, { status: 400 });
    }

    const codigos = await listCollectionDocs("codigosAccesoExterno");
    const ahora = Date.now();
    const codigoDoc = codigos.find((c) => {
      const data = c.data as unknown as CodigoAcceso;
      return data.codigo?.toUpperCase() === codigo && new Date(data.expiraEn).getTime() >= ahora;
    });
    if (!codigoDoc) {
      return NextResponse.json({ error: "El código es incorrecto o ya venció." }, { status: 401 });
    }
    const liceoId = codigoDoc.id;

    const [maestros, centros, usuarios] = await Promise.all([
      listCollectionDocs("maestros_guia"),
      listCollectionDocs("centros_duales"),
      listCollectionDocs("usuarios"),
    ]);

    const yaVinculados = new Set(
      usuarios.map((u) => (u.data as { maestroGuiaId?: string }).maestroGuiaId).filter(Boolean)
    );
    const nombreCentro = new Map(centros.map((c) => [c.id, (c.data as unknown as CentroDual).nombre]));

    const disponibles = maestros
      .filter((m) => {
        const mg = m.data as unknown as MaestroGuia;
        return mg.liceoId === liceoId && mg.estado === "activo" && !yaVinculados.has(m.id);
      })
      .map((m) => {
        const mg = m.data as unknown as MaestroGuia;
        const nombre = `${mg.nombres} ${mg.apellidoPaterno} ${mg.apellidoMaterno ?? ""}`.trim();
        return { id: m.id, nombre, centroDualNombre: nombreCentro.get(mg.centroDualId) ?? "" };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ ok: true, liceoId, maestros: disponibles });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `No fue posible consultar los Maestros Guía. (${detalle})` }, { status: 500 });
  }
}
