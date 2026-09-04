import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Notificacion, TipoNotificacion } from "@/types";

interface DatosNotificacion {
  destinatarioUid: string;
  liceoId: string;
  tipo: TipoNotificacion;
  titulo: string;
  descripcion: string;
  prioridad?: "baja" | "media" | "alta";
  accionHref?: string;
  accionLabel?: string;
}

/** Crea una notificación real dirigida a otro usuario (ej: al crear un
 * ticket se notifica al administrador). Se usa en el momento exacto en que
 * ocurre el evento real — no hay generación retroactiva ni simulada. */
export async function crearNotificacion(datos: DatosNotificacion) {
  const nueva: Omit<Notificacion, "id"> = {
    destinatarioUid: datos.destinatarioUid,
    liceoId: datos.liceoId,
    tipo: datos.tipo,
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    leida: false,
    creadoEn: new Date().toISOString(),
  };
  if (datos.prioridad) nueva.prioridad = datos.prioridad;
  if (datos.accionHref) nueva.accionHref = datos.accionHref;
  if (datos.accionLabel) nueva.accionLabel = datos.accionLabel;
  await addDoc(collection(db, "notificaciones"), nueva);
}
