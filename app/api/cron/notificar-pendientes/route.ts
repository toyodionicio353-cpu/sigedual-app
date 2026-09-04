import { NextResponse } from "next/server";
import { listCollectionDocs } from "@/lib/firebase-admin";
import { crearNotificacionServidor } from "@/lib/notificaciones/crearNotificacion";
import { camposFaltantes } from "@/lib/compatibilidad";
import { camposFaltantesMaestroGuia } from "@/lib/maestro-guia";
import { estadoCanonico, fechaProgramadaDe, profesorSupervisorIdDe } from "@/lib/visitas/normalizar";
import type { Asignacion, CentroDual, Estudiante, MaestroGuia, Usuario, Visita } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ventana de "no repetir el mismo aviso": si ya se notificó a la misma
// persona sobre el mismo elemento hace menos de esto, se omite — pero se
// vuelve a recordar pasado este plazo mientras el problema siga sin
// resolverse.
const DIAS_COOLDOWN = 7;

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Pendiente {
  destinatarioUid: string;
  liceoId: string;
  titulo: string;
  descripcion: string;
  prioridad: "baja" | "media" | "alta";
  accionHref: string;
  accionLabel: string;
}

/** Recorre las mismas condiciones que hoy cuenta la tarjeta "Requiere
 * atención" de Inicio (app/dashboard/page.tsx) pero, en vez de solo sumar un
 * contador, genera una notificación real por cada elemento individual al
 * responsable identificable en el modelo de datos (o a los administradores
 * del liceo cuando no existe un dueño individual). Corre diario vía cron —
 * dos de las cinco condiciones (asignación vencida, visita atrasada) son
 * puramente temporales y no pueden detectarse "al guardar". */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const hoy = hoyISO();
    const [centrosDocs, maestrosDocs, asignacionesDocs, visitasDocs, estudiantesDocs, usuariosDocs, notificacionesDocs] =
      await Promise.all([
        listCollectionDocs("centros_duales"),
        listCollectionDocs("maestros_guia"),
        listCollectionDocs("asignaciones"),
        listCollectionDocs("visitas"),
        listCollectionDocs("estudiantes"),
        listCollectionDocs("usuarios"),
        listCollectionDocs("notificaciones"),
      ]);

    const centros = centrosDocs.map((d) => ({ id: d.id, ...d.data } as CentroDual));
    const maestros = maestrosDocs.map((d) => ({ id: d.id, ...d.data } as MaestroGuia));
    const asignaciones = asignacionesDocs.map((d) => ({ id: d.id, ...d.data } as Asignacion));
    const visitas = visitasDocs.map((d) => ({ id: d.id, ...d.data } as Visita));
    const estudiantes = estudiantesDocs.map((d) => ({ id: d.id, ...d.data } as Estudiante));
    const usuarios = usuariosDocs.map((d) => d.data as unknown as Usuario);

    const administradores = usuarios.filter((u) => u.rol === "administrador");
    const centroExisteMap = new Set(centros.map((c) => c.id));

    const limiteCooldown = new Date();
    limiteCooldown.setDate(limiteCooldown.getDate() - DIAS_COOLDOWN);
    const notificadosRecientes = new Set(
      notificacionesDocs
        .filter((d) => {
          const creadoEn = d.data.creadoEn as string | undefined;
          if (!creadoEn) return false;
          const fecha = new Date(creadoEn);
          return !Number.isNaN(fecha.getTime()) && fecha >= limiteCooldown;
        })
        .map((d) => `${d.data.destinatarioUid}::${d.data.accionHref}`)
    );

    const pendientes: Pendiente[] = [];

    function agregarSiNuevo(p: Pendiente) {
      const clave = `${p.destinatarioUid}::${p.accionHref}`;
      if (notificadosRecientes.has(clave)) return;
      notificadosRecientes.add(clave); // evita duplicar dentro de la misma corrida
      pendientes.push(p);
    }

    function paraAdministradoresDelLiceo(liceoId: string, resto: Omit<Pendiente, "destinatarioUid" | "liceoId">) {
      administradores.forEach((admin) => agregarSiNuevo({ destinatarioUid: admin.uid, liceoId, ...resto }));
    }

    // 1. Centros duales con información incompleta.
    for (const centro of centros) {
      const faltantes = camposFaltantes(centro);
      if (faltantes.length === 0) continue;
      const base = {
        titulo: "Ficha de Centro Dual incompleta",
        descripcion: `Falta completar en "${centro.nombre}": ${faltantes.join(", ")}.`,
        prioridad: "baja" as const,
        accionHref: `/dashboard/centros/${centro.id}`,
        accionLabel: "Completar ficha",
      };
      if (centro.creadoPor) {
        agregarSiNuevo({ destinatarioUid: centro.creadoPor, liceoId: centro.liceoId, ...base });
      } else {
        paraAdministradoresDelLiceo(centro.liceoId, base);
      }
    }

    // 2. Maestros guía con información incompleta.
    for (const mg of maestros) {
      const faltantes = camposFaltantesMaestroGuia(mg, centroExisteMap.has(mg.centroDualId));
      if (faltantes.length === 0) continue;
      const base = {
        titulo: "Ficha de Maestro Guía incompleta",
        descripcion: `Falta completar en "${mg.nombres} ${mg.apellidoPaterno}": ${faltantes.join(", ")}.`,
        prioridad: "baja" as const,
        accionHref: `/dashboard/centros/maestros/${mg.id}`,
        accionLabel: "Completar ficha",
      };
      if (mg.creadoPor) {
        agregarSiNuevo({ destinatarioUid: mg.creadoPor, liceoId: mg.liceoId, ...base });
      } else {
        paraAdministradoresDelLiceo(mg.liceoId, base);
      }
    }

    // 3. Asignaciones con fecha de término vencida.
    for (const asig of asignaciones) {
      if (!(asig.estado === "asignada" || asig.estado === "activa")) continue;
      if (!asig.fechaTermino || asig.fechaTermino >= hoy) continue;
      const estudiante = estudiantes.find((e) => e.id === asig.estudianteId);
      const base = {
        titulo: "Asignación vencida",
        descripcion: `La asignación de ${estudiante ? `${estudiante.nombres} ${estudiante.apellidos}` : "un estudiante"} venció el ${asig.fechaTermino}. Actualiza su estado.`,
        prioridad: "media" as const,
        accionHref: `/dashboard/estudiantes/asignaciones/${asig.id}`,
        accionLabel: "Ver asignación",
      };
      if (asig.profesorSupervisorId) {
        agregarSiNuevo({ destinatarioUid: asig.profesorSupervisorId, liceoId: asig.liceoId, ...base });
      } else {
        paraAdministradoresDelLiceo(asig.liceoId, base);
      }
    }

    // 4. Visitas agendadas que quedaron atrasadas.
    for (const visita of visitas) {
      if (estadoCanonico(visita.estado) !== "agendada") continue;
      if (fechaProgramadaDe(visita) >= hoy) continue;
      const centro = centros.find((c) => c.id === visita.centroDualId);
      const base = {
        titulo: "Visita atrasada",
        descripcion: `La visita a "${centro?.nombre ?? "un centro dual"}" programada para el ${fechaProgramadaDe(visita)} sigue sin iniciarse.`,
        prioridad: "media" as const,
        accionHref: `/dashboard/visitas/${visita.id}`,
        accionLabel: "Ver visita",
      };
      const responsable = profesorSupervisorIdDe(visita);
      if (responsable) {
        agregarSiNuevo({ destinatarioUid: responsable, liceoId: visita.liceoId, ...base });
      } else {
        paraAdministradoresDelLiceo(visita.liceoId, base);
      }
    }

    // 5. Estudiantes activos sin una asignación vigente.
    const idsConAsignacionActiva = new Set(
      asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa").map((a) => a.estudianteId)
    );
    for (const estudiante of estudiantes) {
      if (estudiante.estado !== "activo") continue;
      if (idsConAsignacionActiva.has(estudiante.id)) continue;
      const base = {
        titulo: "Estudiante sin empresa asignada",
        descripcion: `${estudiante.nombres} ${estudiante.apellidos} no tiene una asignación activa a un Centro Dual.`,
        prioridad: "media" as const,
        accionHref: `/dashboard/estudiantes/${estudiante.id}`,
        accionLabel: "Ver ficha",
      };
      const ultimaAsignacion = asignaciones
        .filter((a) => a.estudianteId === estudiante.id && (a.estado === "finalizada" || a.estado === "cancelada") && a.profesorSupervisorId)
        .sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""))[0];
      if (ultimaAsignacion?.profesorSupervisorId) {
        agregarSiNuevo({ destinatarioUid: ultimaAsignacion.profesorSupervisorId, liceoId: estudiante.liceoId, ...base });
      } else {
        paraAdministradoresDelLiceo(estudiante.liceoId, base);
      }
    }

    for (const p of pendientes) {
      await crearNotificacionServidor({
        destinatarioUid: p.destinatarioUid,
        liceoId: p.liceoId,
        tipo: "recordatorio",
        titulo: p.titulo,
        descripcion: p.descripcion,
        prioridad: p.prioridad,
        accionHref: p.accionHref,
        accionLabel: p.accionLabel,
      });
    }

    return NextResponse.json({ ok: true, notificacionesCreadas: pendientes.length });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: detalle }, { status: 500 });
  }
}
