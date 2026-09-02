import { NextResponse } from "next/server";
import { listCollectionDocs, setDocument, deleteDocument } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENCION_ANIOS = 5;

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const estudiantes = await listCollectionDocs("estudiantes");
    const limite = new Date();
    limite.setFullYear(limite.getFullYear() - RETENCION_ANIOS);

    const vencidos = estudiantes.filter((e) => {
      const creadoEn = e.data.creadoEn;
      if (typeof creadoEn !== "string") return false;
      const fecha = new Date(creadoEn);
      return !Number.isNaN(fecha.getTime()) && fecha <= limite;
    });

    for (const est of vencidos) {
      await setDocument(`estudiantes_archivados/${est.id}`, {
        ...est.data,
        eliminadoEn: new Date().toISOString(),
        motivoEliminacion: `Política de retención de datos: más de ${RETENCION_ANIOS} años registrado en SIGEDUAL.`,
      });
      await deleteDocument(`estudiantes/${est.id}`);
    }

    return NextResponse.json({ ok: true, revisados: estudiantes.length, eliminados: vencidos.length });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: detalle }, { status: 500 });
  }
}
