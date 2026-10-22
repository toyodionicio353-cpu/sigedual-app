import type { CentroDual, Estudiante } from "@/types";

/**
 * Datos de perfil que una cuenta nueva hereda de la ficha a la que se
 * vincula, para que nadie tenga que volver a escribir lo que el liceo ya
 * registró al crear el Centro Dual o al matricular al estudiante.
 *
 * Reglas que valen para ambos casos:
 *
 *  - Solo se copia lo que es LA MISMA COSA en ambos lados. El RUT de una
 *    empresa no es el RUN de la persona que la representa, así que no se
 *    copia: dejar el campo vacío es honesto, llenarlo sería un dato falso.
 *  - Un campo vacío en la ficha no viaja. Guardar `""` en el perfil haría
 *    que el usuario "ya tuviera" un dato que no tiene.
 *  - Es un punto de partida, no un candado: el usuario puede corregir
 *    cualquiera de estos campos desde Administración → Usuario.
 */
type Perfil = Record<string, string>;

function soloConValor(campos: Record<string, string | undefined>): Perfil {
  const salida: Perfil = {};
  for (const [clave, valor] of Object.entries(campos)) {
    const limpio = valor?.trim();
    if (limpio) salida[clave] = limpio;
  }
  return salida;
}

/**
 * Cuenta a nivel de empresa. El perfil describe a la persona que
 * representa al Centro Dual, así que se prefiere el teléfono del contacto
 * por sobre el de la empresa; si existen los dos y son distintos, el de la
 * empresa queda como teléfono secundario en vez de perderse.
 */
export function perfilDesdeCentroDual(centro: CentroDual): Perfil {
  const contacto = centro.contactoTelefono?.trim();
  const empresa = centro.telefono?.trim();
  return soloConValor({
    direccion: centro.direccion,
    comuna: centro.comuna,
    ciudad: centro.ciudad,
    region: centro.region,
    telefono: contacto || empresa,
    telefonoSecundario: contacto && empresa && contacto !== empresa ? empresa : undefined,
  });
}

/** Cuenta de estudiante: el perfil describe a la misma persona que la
 * ficha, así que también viajan el RUN, la fecha de nacimiento y la
 * nacionalidad. */
export function perfilDesdeEstudiante(estudiante: Estudiante): Perfil {
  return soloConValor({
    run: estudiante.run,
    fechaNacimiento: estudiante.fechaNacimiento,
    nacionalidad: estudiante.nacionalidad,
    direccion: estudiante.direccion,
    comuna: estudiante.comuna,
    ciudad: estudiante.ciudad,
    telefono: estudiante.telefono,
  });
}
