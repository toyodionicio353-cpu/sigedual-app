import { listCollectionDocs, deleteDocument, updateDocumentFields, setAuthUserDisabled } from "@/lib/firebase-admin";
import { registrarEventoServidor } from "@/lib/auditoria/registrarEvento";

/**
 * Colecciones propias de una institución (todas llevan `liceoId`) que se
 * purgan al eliminar los datos de una Demo. Deliberadamente NO incluye:
 * `usuarios` (se desactivan, nunca se eliminan — ver más abajo), `liceos`
 * (el registro de la institución se conserva, solo se marca), `auditoria`
 * (se conserva siempre) ni `demos`/`codigosAcceso` (se tratan aparte).
 */
const COLECCIONES_A_PURGAR = [
  "solicitudesModificacion", "soporte", "tickets", "notificaciones",
  "estudiantes", "asignaciones", "centros_duales", "maestros_guia", "visitas",
  "autorizaciones", "conversaciones", "invitaciones", "respuestas_invitacion",
  "centros_duales_por_rut", "evaluaciones", "invitaciones_estudiante",
  "respuestas_invitacion_estudiante", "estudiantes_por_run", "campanias_invitacion",
  "campanias_invitacion_estudiante", "respuestas_campania", "respuestas_campania_estudiante",
  "especialidades", "documentos_generados", "documentos_generados_indices",
];

/**
 * Elimina únicamente los datos que pertenecen a una institución Demo
 * (identificados por `liceoId`, nunca por fecha de creación) y desactiva —
 * sin eliminar — a sus usuarios. Respeta la relación real con la Demo: solo
 * toca documentos cuyo `liceoId` coincide exactamente con esta institución,
 * nunca una eliminación masiva de colecciones completas.
 */
export async function eliminarDatosDemo(params: {
  liceoId: string; demoId: string; solicitadoPor: string; solicitadoPorNombre: string;
}): Promise<{ documentosEliminados: number; usuariosDesactivados: number }> {
  let documentosEliminados = 0;
  for (const coleccion of COLECCIONES_A_PURGAR) {
    const docs = await listCollectionDocs(coleccion);
    const propios = docs.filter((d) => d.data.liceoId === params.liceoId);
    for (const d of propios) {
      await deleteDocument(`${coleccion}/${d.id}`);
      documentosEliminados++;
    }
  }

  // `codigosAcceso` usa el propio liceoId como id de documento.
  await deleteDocument(`codigosAcceso/${params.liceoId}`).catch(() => {});

  const usuarios = await listCollectionDocs("usuarios");
  const usuariosDelLiceo = usuarios.filter((u) => u.data.liceoId === params.liceoId);
  for (const u of usuariosDelLiceo) {
    await setAuthUserDisabled(u.id, true);
    await updateDocumentFields(`usuarios/${u.id}`, { activo: false });
  }

  const ahora = new Date().toISOString();
  // El Liceo NO se elimina — es la información estructural de la
  // institución (y lo que mantiene la integridad referencial de los
  // usuarios desactivados); solo se marca inactivo.
  await updateDocumentFields(`liceos/${params.liceoId}`, { estado: "inactivo", demoEstado: "datos_eliminados" });
  await updateDocumentFields(`demos/${params.demoId}`, {
    estado: "datos_eliminados",
    eliminacionSolicitadaEn: ahora, eliminacionSolicitadaPor: params.solicitadoPor,
    eliminadoEn: ahora, eliminadoPor: params.solicitadoPor,
  });

  await registrarEventoServidor({
    uid: params.solicitadoPor, nombre: params.solicitadoPorNombre, rol: "director",
    liceoId: params.liceoId, accion: "demo.eliminar_datos", recurso: "demos", recursoId: params.demoId,
    resultado: "permitido",
    detalle: `${documentosEliminados} documentos eliminados, ${usuariosDelLiceo.length} usuarios desactivados.`,
  });

  return { documentosEliminados, usuariosDesactivados: usuariosDelLiceo.length };
}
