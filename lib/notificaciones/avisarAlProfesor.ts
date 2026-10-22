import { crearNotificacion } from "./crearNotificacion";
import type { TipoNotificacion } from "@/types";

/**
 * Avisa al Profesor Supervisor de algo que ocurrió en el Centro Dual.
 *
 * Lo que el centro registra no sirve de nada si nadie se entera: una
 * ausencia avisada no suma hasta que el liceo la confirma, y un reclamo
 * sin destinatario se queda en una pantalla que ese profesor no visita.
 * Por eso cada registro del centro deja una notificación con un enlace
 * directo al lugar donde se resuelve.
 *
 * Si la asignación no tiene Profesor Supervisor no hay a quién avisar:
 * falla en silencio y no rompe el registro, que es lo importante — la
 * falta queda guardada igual y sigue visible en la ficha.
 */
export async function avisarAlProfesor(datos: {
  profesorSupervisorId?: string;
  liceoId: string;
  tipo: TipoNotificacion;
  titulo: string;
  descripcion: string;
  prioridad?: "baja" | "media" | "alta";
  /** Enlace al punto exacto de la ficha donde se atiende. */
  accionHref: string;
  accionLabel: string;
  recurso: string;
  recursoId: string;
}): Promise<void> {
  if (!datos.profesorSupervisorId) return;
  try {
    await crearNotificacion({
      destinatarioUid: datos.profesorSupervisorId,
      liceoId: datos.liceoId,
      tipo: datos.tipo,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      prioridad: datos.prioridad,
      accionHref: datos.accionHref,
      accionLabel: datos.accionLabel,
      recurso: datos.recurso,
      recursoId: datos.recursoId,
    });
  } catch {
    // Un aviso que no se pudo entregar no puede deshacer lo ya registrado.
  }
}
