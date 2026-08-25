import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type TipoEvento = "crear"|"editar"|"eliminar"|"login"|"logout"|"error";

interface RegistroAuditoria {
  tipo:     TipoEvento;
  modulo:   string;
  actor:    string;
  detalle:  string;
  liceoId:  string;
  uid?:     string;
  ip?:      string;
}

export async function registrarAuditoria(datos: RegistroAuditoria) {
  try {
    await addDoc(collection(db, "auditoria"), {
      ...datos,
      ts: serverTimestamp(),
    });
  } catch (err) {
    console.error("[SIGEDUAL] Error registrando auditoría:", err);
  }
}
