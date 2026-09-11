import {
  collection, doc, setDoc, addDoc, updateDoc,
  arrayUnion, increment, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { crearNotificacion } from "@/lib/notificaciones/crearNotificacion";
import { marcarNotificacionesDeRecurso } from "@/lib/notificaciones/marcarPorRecurso";
import type { Conversacion, Usuario } from "@/types";

const PREVIA_MAX = 140;

interface DatosNuevoHilo {
  autor: Usuario;
  destinatarios: string[];
  asunto: string;
  cuerpo: string;
}

/** Crea un hilo nuevo con su primer mensaje y avisa a cada destinatario.
 * Devuelve el id del hilo para poder abrirlo enseguida. */
export async function iniciarConversacion({ autor, destinatarios, asunto, cuerpo }: DatosNuevoHilo): Promise<string> {
  const ahora = new Date().toISOString();
  const ref = doc(collection(db, "conversaciones"));
  const participantes = Array.from(new Set([autor.uid, ...destinatarios]));

  const nueva: Omit<Conversacion, "id"> = {
    tipo: destinatarios.length > 1 ? "grupo" : "privada",
    asunto: asunto.trim() || "(sin asunto)",
    participantes,
    liceoId: autor.liceoId,
    ultimoMensaje: previa(cuerpo),
    ultimoRemitenteUid: autor.uid,
    ultimoRemitenteNombre: autor.nombre,
    remitentes: [autor.uid],
    cantidadMensajes: 1,
    ultimaActividad: ahora,
    noLeidoPor: destinatarios,
    creadoPor: autor.uid,
    creadoEn: ahora,
  };
  await setDoc(ref, nueva);
  await addDoc(collection(db, "conversaciones", ref.id, "mensajes"), {
    texto: cuerpo.trim(), uid: autor.uid, nombre: autor.nombre, creadoEn: ahora,
  });
  await notificar(destinatarios, autor, nueva.asunto ?? "", cuerpo, ref.id);
  return ref.id;
}

/** Agrega una respuesta a un hilo existente: la deja como no leída para el
 * resto de los participantes y la saca de la papelera de quien responde. */
export async function responderConversacion(conversacion: Conversacion, autor: Usuario, cuerpo: string): Promise<void> {
  const ahora = new Date().toISOString();
  const otros = conversacion.participantes.filter((p) => p !== autor.uid);

  await addDoc(collection(db, "conversaciones", conversacion.id, "mensajes"), {
    texto: cuerpo.trim(), uid: autor.uid, nombre: autor.nombre, creadoEn: ahora,
  });
  await updateDoc(doc(db, "conversaciones", conversacion.id), {
    ultimoMensaje: previa(cuerpo),
    ultimoRemitenteUid: autor.uid,
    ultimoRemitenteNombre: autor.nombre,
    remitentes: arrayUnion(autor.uid),
    cantidadMensajes: increment(1),
    ultimaActividad: ahora,
    noLeidoPor: otros,
  });
  await notificar(otros, autor, conversacion.asunto ?? conversacion.nombre ?? "", cuerpo, conversacion.id);
}

/** Marca el hilo como leído por quien lo abre. Se hace con una lectura
 * previa para no escribir cuando ya estaba leído (evita ruido en el
 * onSnapshot de todos los participantes). */
export async function marcarHiloLeido(conversacionId: string, uid: string): Promise<void> {
  const snap = await getDoc(doc(db, "conversaciones", conversacionId));
  if (!snap.exists()) return;
  const datos = snap.data() as Conversacion;
  // Hilo que este usuario ya tenía leído: no hay nada que apagar, y salir
  // acá evita consultar su bandeja cada vez que abre una conversación.
  if (!datos.noLeidoPor?.includes(uid)) return;

  await updateDoc(doc(db, "conversaciones", conversacionId), {
    noLeidoPor: datos.noLeidoPor.filter((u) => u !== uid),
  });

  // Haber abierto el hilo ya es haberse enterado: el aviso de la campana
  // se apaga aunque el usuario haya llegado por Mensajes y no desde la
  // notificación. Solo hace falta para un hilo que estaba sin leer, que es
  // exactamente cuando existe una notificación suya pendiente.
  await marcarNotificacionesDeRecurso(uid, "conversacion", conversacionId);
}

function previa(cuerpo: string): string {
  const limpio = cuerpo.trim().replace(/\s+/g, " ");
  return limpio.length > PREVIA_MAX ? `${limpio.slice(0, PREVIA_MAX)}…` : limpio;
}

/** Aviso discreto en la campana ya existente, con enlace directo al hilo —
 * no se inventa un canal de notificaciones nuevo. */
async function notificar(destinatarios: string[], autor: Usuario, asunto: string, cuerpo: string, conversacionId: string) {
  await Promise.all(
    destinatarios.map((destinatarioUid) =>
      crearNotificacion({
        destinatarioUid,
        liceoId: autor.liceoId,
        tipo: "mensaje",
        titulo: asunto || `Mensaje de ${autor.nombre}`,
        descripcion: `${autor.nombre}: ${previa(cuerpo)}`,
        accionHref: `/dashboard/mensajes?hilo=${conversacionId}`,
        accionLabel: "Abrir mensaje",
        recurso: "conversacion",
        recursoId: conversacionId,
      }).catch(() => {})
    )
  );
}
