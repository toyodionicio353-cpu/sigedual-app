import { NextResponse } from "next/server";
import {
  requireCallerUid, getDocument, getDocumentConVersion,
  commitTransaccional, esConflictoDeEscritura,
} from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";
import { validarNovedad } from "@/lib/novedades/validar";
import {
  MAX_POR_SEMESTRE, idCupo, periodoDe, esEditorIndependiente,
  LICEO_SIGEDUAL, NOMBRE_SIGEDUAL,
} from "@/lib/novedades/semestre";
import type { Rol } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES_AUTORIZADOS: Rol[] = ["desarrollador", "director", "coordinador"];
/** Reintentos ante conflicto de cupo. Un conflicto significa que otra
 * publicación del mismo liceo entró primero: se vuelve a leer el contador
 * y se reevalúa, que es justo lo que impide pasarse de 20. */
const REINTENTOS = 5;

/**
 * Publica una novedad. Pasa por el servidor y no por el cliente porque el
 * límite de 20 por semestre solo es real si se comprueba e incrementa en
 * la MISMA operación atómica: contando documentos desde el navegador, dos
 * publicaciones simultáneas se colarían ambas como la número 20.
 *
 * Las reglas de Firestore acompañan esta decisión — el cliente no puede
 * escribir `cupos_novedades` ni pasar una novedad a "publicada".
 */
export async function POST(request: Request) {
  try {
    const uid = await requireCallerUid(request);

    const ficha = await getDocument(`usuarios/${uid}`);
    if (!ficha) return NextResponse.json({ error: "No autorizado: no se encontró tu ficha de usuario." }, { status: 403 });
    const rol = ficha.data.rol as Rol;
    if (!ROLES_AUTORIZADOS.includes(rol)) {
      return NextResponse.json({ error: "No autorizado: tu rol no puede publicar novedades." }, { status: 403 });
    }

    const cuerpo = (await request.json()) as Record<string, unknown>;

    // El editor independiente es SIGEDUAL publicando en su propio nombre,
    // no como uno de los liceos: no consume el cupo de ningún
    // establecimiento y sus avisos se firman como SIGEDUAL.
    const independiente = esEditorIndependiente(rol);

    // Para el resto, el liceo sale de la ficha del usuario y NUNCA del
    // cuerpo de la petición: si viniera de afuera, cualquiera podría
    // publicar a nombre de otro liceo y gastarle su cupo.
    const liceoId = independiente ? LICEO_SIGEDUAL : ((ficha.data.liceoId as string) ?? "");
    if (!liceoId) {
      return NextResponse.json({ error: "Tu cuenta no tiene un liceo asociado; no se puede publicar." }, { status: 400 });
    }

    const ahora = new Date();
    const validacion = validarNovedad(cuerpo, ahora, independiente);
    if ("error" in validacion) return NextResponse.json({ error: validacion.error }, { status: 400 });
    const datos = validacion.datos;

    let liceoNombre = NOMBRE_SIGEDUAL;
    if (!independiente) {
      const liceo = await getDocument(`liceos/${liceoId}`);
      liceoNombre = (liceo?.data.nombre as string) ?? "Liceo";
    }

    const periodo = periodoDe(ahora);
    const rutaCupo = `cupos_novedades/${idCupo(liceoId, periodo)}`;
    const borradorId = typeof cuerpo.borradorId === "string" ? cuerpo.borradorId : "";

    const construirNovedad = (id: string) => ({
      liceoId, liceoNombre,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      fuente: datos.fuente,
      imagenes: datos.imagenes,
      estado: "publicada",
      creadoPor: uid,
      creadoPorNombre: (ficha.data.nombre as string) ?? "",
      creadoEn: (typeof cuerpo.creadoEn === "string" && cuerpo.creadoEn) || ahora.toISOString(),
      publicadoEn: ahora.toISOString(),
      expiraEn: datos.expiraEn,
      visualizaciones: 0,
      semestre: periodo.semestre,
      anio: periodo.anio,
      independiente,
      id,
    });

    const nuevoId = () => borradorId || `${liceoId}_${ahora.getTime()}_${Math.random().toString(36).slice(2, 8)}`;

    // El editor independiente no pasa por el contador semestral: ese cupo
    // reparte un recurso entre establecimientos, y SIGEDUAL no es uno de
    // ellos. Sin contador disputado, tampoco hace falta la escritura
    // atómica ni los reintentos.
    if (independiente) {
      const id = nuevoId();
      const { id: _descartar, ...novedad } = construirNovedad(id);
      void _descartar;
      await commitTransaccional([{ tipo: "set", path: `novedades/${id}`, data: novedad }]);

      await registrarEventoServidor({
        uid, nombre: (ficha.data.nombre as string) ?? "", rol,
        liceoId, accion: "publicar_novedad", recurso: "novedades", recursoId: id,
        resultado: "permitido", detalle: datos.titulo,
      });
      return NextResponse.json({ ok: true, id, independiente: true });
    }

    for (let intento = 0; intento < REINTENTOS; intento++) {
      const cupo = await getDocumentConVersion(rutaCupo);
      const publicadas = typeof cupo?.data.publicadas === "number" ? cupo.data.publicadas : 0;

      if (publicadas >= MAX_POR_SEMESTRE) {
        return NextResponse.json({
          error: `Tu liceo ya alcanzó el límite de ${MAX_POR_SEMESTRE} publicaciones de este semestre. El cupo se renueva al comenzar el siguiente.`,
          publicadas, limite: MAX_POR_SEMESTRE,
        }, { status: 409 });
      }

      const id = borradorId || `${liceoId}_${ahora.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
      const novedad = {
        liceoId, liceoNombre,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        fuente: datos.fuente,
        imagenes: datos.imagenes,
        estado: "publicada",
        creadoPor: uid,
        creadoPorNombre: (ficha.data.nombre as string) ?? "",
        creadoEn: (typeof cuerpo.creadoEn === "string" && cuerpo.creadoEn) || ahora.toISOString(),
        publicadoEn: ahora.toISOString(),
        expiraEn: datos.expiraEn,
        visualizaciones: 0,
        semestre: periodo.semestre,
        anio: periodo.anio,
      };

      const datosCupo = {
        liceoId, anio: periodo.anio, semestre: periodo.semestre,
        publicadas: publicadas + 1,
        actualizadoEn: ahora.toISOString(),
      };

      try {
        // La novedad y el contador se escriben juntos. La precondición
        // sobre el contador (su updateTime, o que no exista) es lo que
        // hace fallar la operación si alguien publicó mientras tanto.
        await commitTransaccional([
          cupo
            ? { tipo: "update", path: rutaCupo, data: datosCupo, updateTime: cupo.updateTime }
            : { tipo: "create", path: rutaCupo, data: datosCupo },
          // La novedad va como "set", sin precondición propia: publicar
          // sobre su propio borrador es justamente sobrescribirlo. El
          // recurso disputado es el contador, y esa precondición ya
          // protege a las dos escrituras, que van en el mismo commit.
          { tipo: "set", path: `novedades/${id}`, data: novedad },
        ]);

        await registrarEventoServidor({
          uid, nombre: (ficha.data.nombre as string) ?? "", rol,
          liceoId, accion: "publicar_novedad", recurso: "novedades", recursoId: id,
          resultado: "permitido", detalle: datos.titulo,
        });

        return NextResponse.json({
          ok: true, id,
          publicadas: publicadas + 1, limite: MAX_POR_SEMESTRE,
        });
      } catch (err) {
        if (!esConflictoDeEscritura(err) || intento === REINTENTOS - 1) throw err;
        // Otra publicación del mismo liceo llegó primero: se relee el
        // contador y se vuelve a comprobar el cupo desde cero.
        await new Promise((r) => setTimeout(r, 80 * (intento + 1)));
      }
    }

    return NextResponse.json({ error: "No se pudo publicar por concurrencia. Vuelve a intentarlo." }, { status: 409 });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error inesperado al publicar la novedad.";
    const noAutorizado = mensaje.startsWith("No autorizado");
    return NextResponse.json({ error: mensaje }, { status: noAutorizado ? 403 : 500 });
  }
}
