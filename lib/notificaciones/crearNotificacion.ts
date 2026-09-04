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

function construirNotificacion(datos: DatosNotificacion): Omit<Notificacion, "id"> {
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
  return nueva;
}

/** Crea una notificación real dirigida a otro usuario (ej: al crear un
 * ticket se notifica al administrador). Se usa en el momento exacto en que
 * ocurre el evento real — no hay generación retroactiva ni simulada. */
export async function crearNotificacion(datos: DatosNotificacion) {
  await addDoc(collection(db, "notificaciones"), construirNotificacion(datos));
}

/** Misma notificación, pero escrita desde una ruta de API de servidor (sin
 * sesión de Firebase Auth del destinatario) usando el cliente REST con
 * privilegio de cuenta de servicio — ej: cuando una empresa sin cuenta
 * envía el formulario de invitación y hay que notificar al profesor. */
export async function crearNotificacionServidor(datos: DatosNotificacion) {
  const { addDocument } = await import("@/lib/firebase-admin");
  await addDocument("notificaciones", construirNotificacion(datos));
}
