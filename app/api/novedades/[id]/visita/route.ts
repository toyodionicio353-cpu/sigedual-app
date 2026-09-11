import { NextResponse } from "next/server";
import { getDocument, updateDocumentFields } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Suma una visualización a una novedad.
 *
 * Pasa por el servidor porque quien la abre no tiene sesión: dejar que el
 * navegador escribiera el contador exigiría una regla de Firestore que
 * permitiera a cualquiera modificar el documento, y entonces el número no
 * significaría nada.
 *
 * La protección contra recargas es del lado del visitante (el navegador
 * recuerda las novedades que ya contó). No se identifican visitantes ni
 * se guardan direcciones IP: es un contador de interés, no una analítica
 * de personas, y el requerimiento pide explícitamente no crear cuentas de
 * visitante.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const novedad = await getDocument(`novedades/${id}`);
    // Solo cuentan las publicadas: nadie debe poder inflar el contador de
    // un borrador que ni siquiera es público.
    if (!novedad || novedad.data.estado !== "publicada") {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const actual = typeof novedad.data.visualizaciones === "number" ? novedad.data.visualizaciones : 0;
    await updateDocumentFields(`novedades/${id}`, { visualizaciones: actual + 1 });
    return NextResponse.json({ ok: true, visualizaciones: actual + 1 });
  } catch {
    // Que no se pueda contar una visita jamás debe impedir leer la noticia.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
