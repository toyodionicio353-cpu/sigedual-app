import type { Usuario } from "@/types";

/**
 * Traduce un fallo de lectura de Firestore a una frase que sirva para algo.
 *
 * "Este estudiante no está dentro de tu ámbito autorizado" era siempre la
 * misma respuesta para causas muy distintas: una cuenta sin liceo, un
 * estudiante de otro establecimiento o unas reglas que todavía no se han
 * publicado. Quien ve la pantalla no puede distinguirlas, y quien tiene que
 * arreglarlo tampoco.
 */
export function motivoDenegacion(error: unknown, usuario: Pick<Usuario, "rol" | "liceoId">): string {
  const codigo =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (!usuario.liceoId) {
    return "Tu cuenta no tiene un liceo asignado, así que no alcanza ninguna ficha. Pídele al administrador que te asigne el liceo.";
  }
  if (codigo === "permission-denied") {
    return "Las reglas de seguridad rechazaron la lectura. Las dos causas habituales: el estudiante pertenece a otro liceo, o las reglas nuevas todavía no están publicadas en Firebase.";
  }
  if (codigo === "unavailable" || codigo === "deadline-exceeded") {
    return "No se pudo conectar con la base de datos. Revisa tu conexión y vuelve a intentarlo.";
  }
  return codigo ? `No se pudo leer la ficha (${codigo}).` : "No se pudo leer la ficha.";
}

/** Una línea de contexto para el pie de la pantalla: sin esto, un "acceso
 * denegado" no dice contra qué liceo se comparó. */
export function detalleCuenta(usuario: Pick<Usuario, "rol" | "liceoId">): string {
  return `Tu cuenta — rol: ${usuario.rol} · liceo: ${usuario.liceoId || "(sin asignar)"}`;
}
