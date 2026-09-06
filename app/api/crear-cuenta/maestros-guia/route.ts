import { NextResponse } from "next/server";
import { listCollectionDocs } from "@/lib/firebase-admin";
import type { CentroDual, CodigoAcceso, Liceo, MaestroGuia } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista los Maestros Guía activos del liceo del correo dado, que todavía no
 * tienen una cuenta de acceso vinculada — para poblar el selector "Centro
 * Dual / Maestro Guía" en /crear-cuenta. Sin sesión (todavía no existe
 * cuenta en este punto del registro), por eso exige el mismo código de
 * verificación que ya protege la creación de cuentas, en vez de exponer
 * la lista a cualquiera que solo conozca el dominio del correo.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    const codigo = url.searchParams.get("codigo")?.trim().toUpperCase() ?? "";
    const dominio = email.split("@")[1];
    if (!dominio || !codigo) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    const liceos = await listCollectionDocs("liceos");
    const liceoDoc = liceos.find((l) => (l.data as unknown as Liceo).dominioCorreo?.toLowerCase() === dominio);
    if (!liceoDoc) {
      return NextResponse.json({ error: "Este dominio de correo no está autorizado." }, { status: 404 });
    }
    const liceoId = liceoDoc.id;

    const codigos = await listCollectionDocs("codigosAcceso");
    const codigoDoc = codigos.find((c) => c.id === liceoId);
    if (!codigoDoc) {
      return NextResponse.json({ error: "Aún no hay un código de verificación activo para tu institución." }, { status: 404 });
    }
    const codigoData = codigoDoc.data as unknown as CodigoAcceso;
    const expirado = new Date(codigoData.expiraEn).getTime() < Date.now();
    if (codigoData.codigo.toUpperCase() !== codigo || expirado) {
      return NextResponse.json({ error: "El código de verificación es incorrecto o ya venció." }, { status: 401 });
    }

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
