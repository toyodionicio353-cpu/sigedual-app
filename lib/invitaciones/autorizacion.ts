import { getDocument } from "@/lib/firebase-admin";
import type { Rol } from "@/types";

/**
 * Verifica, con privilegio de servidor, si `uid` puede actuar sobre la
 * invitación `invitacionId` — el profesor que la generó, o
 * administrador/director/coordinador de su liceo. Se usa en las rutas de
 * API que revisan o autorrellenan una invitación (nunca por el cliente
 * directo, que no tiene permiso de lectura sobre estos documentos salvo que
 * ya sea el dueño).
 */
export async function verificarAccesoInvitacion(
  uid: string,
  invitacion: { profesorUid: string; liceoId: string }
): Promise<boolean> {
  if (invitacion.profesorUid === uid) return true;
  const usuarioDoc = await getDocument(`usuarios/${uid}`);
  const rol = usuarioDoc?.data.rol as Rol | undefined;
  const liceoIdUsuario = usuarioDoc?.data.liceoId as string | undefined;
  if (rol === "administrador") return true;
  if ((rol === "director" || rol === "coordinador") && liceoIdUsuario === invitacion.liceoId) return true;
  return false;
}
