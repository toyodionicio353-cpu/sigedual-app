"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearFecha } from "@/lib/fecha";
import { estadoCanonico, fechaProgramadaDe, ESTADO_VISITA_LABEL, ESTADO_VISITA_COLOR } from "@/lib/visitas/normalizar";
import type { Asignacion, EstadoAsignacion, Estudiante, CentroDual, Visita, Usuario, Evaluacion, Liceo } from "@/types";
import { ArrowLeft, Pencil, Power, MapPin, ClipboardCheck, Users, Building2, CalendarCheck, Mail, Phone, IdCard, Home, School } from "lucide-react";

const ESTADO_ASIGNACION_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: "Pendiente", en_proceso: "En proceso", asignada: "Asignada",
  activa: "Activa", finalizada: "Finalizada", cancelada: "Cancelada",
};

function Bloque({ titulo, id, children }: { titulo: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", scrollMarginTop: 80 }} className="rounded-2xl p-5 sm:p-6 mb-5">
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">{titulo}</p>
      {children}
    </div>
  );
}

function Cifra({ icono, valor, etiqueta }: { icono: React.ReactNode; valor: number; etiqueta: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
      <span style={{ color: "var(--accent-light)" }} className="flex items-center">{icono}</span>
      <p style={{ color: "var(--text-primary)" }} className="text-2xl font-black leading-none mt-2">{valor}</p>
      <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-1 leading-snug">{etiqueta}</p>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-0.5">{label}</p>
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">{valor}</p>
    </div>
  );
}

export default function FichaProfesorPage() {
  const { uid } = useParams<{ uid: string }>();
  const { usuario } = useAuth();

  const [profesor, setProfesor] = useState<Usuario | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [liceo, setLiceo] = useState<Liceo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  const tieneAccesoGlobal = usuario?.rol === "desarrollador" || usuario?.rol === "coordinador" || usuario?.rol === "director";
  const puedeGestionar = usuario?.rol === "desarrollador";

  useEffect(() => {
    if (!usuario || !uid) return;
    async function cargar() {
      setLoading(true);
      setError(false);
      try {
        const snapProf = await getDoc(doc(db, "usuarios", uid));
        if (!snapProf.exists() || (snapProf.data() as Usuario).rol !== "profesor") {
          setNoEncontrado(true);
          setLoading(false);
          return;
        }
        setProfesor(snapProf.data() as Usuario);

        const [snapAsig, snapEst] = await Promise.all([
          getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId))),
          getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
        ]);
        setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
        setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));

        const [snapVisitasNuevas, snapVisitasLegado] = await Promise.all([
          getDocs(query(collection(db, "visitas"), where("profesorSupervisorId", "==", uid))),
          getDocs(query(collection(db, "visitas"), where("profesorId", "==", uid))),
        ]);
        const visitasMap = new Map<string, Visita>();
        for (const d of [...snapVisitasNuevas.docs, ...snapVisitasLegado.docs]) {
          visitasMap.set(d.id, { id: d.id, ...d.data() } as Visita);
        }
        const listaVisitas = Array.from(visitasMap.values());
        setVisitas(listaVisitas);

        const datosProf = snapProf.data() as Usuario;

        // Evaluaciones que ESTE profesor firmó. Se consulta por liceoId
        // (un solo campo, que las reglas ya permiten a quien puede abrir
        // esta ficha) y se filtra en memoria por evaluadorUid: filtrar por
        // los dos en la consulta exigiria un indice compuesto.
        getDocs(query(collection(db, "evaluaciones"), where("liceoId", "==", datosProf.liceoId)))
          .then((snap) => setEvaluaciones(
            snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluacion))
              .filter((e) => e.evaluadorUid === uid)
          ))
          .catch(() => setEvaluaciones([]));

        getDoc(doc(db, "liceos", datosProf.liceoId))
          .then((snap) => { if (snap.exists()) setLiceo({ id: snap.id, ...snap.data() } as Liceo); })
          .catch(() => setLiceo(null));

        const asignacionesSuyas = snapAsig.docs
          .map((d) => ({ id: d.id, ...d.data() } as Asignacion))
          .filter((a) => a.profesorSupervisorId === uid);
        const centroIds = Array.from(new Set([
          ...listaVisitas.map((v) => v.centroDualId),
          ...asignacionesSuyas.map((a) => a.centroDualId),
        ].filter(Boolean)));
        if (centroIds.length > 0) {
          const snapsCentros = await Promise.all(centroIds.map((cid) => getDoc(doc(db, "centros_duales", cid))));
          setCentros(snapsCentros.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() } as CentroDual)));
        }
      } catch (err) {
        console.error("Error al cargar ficha de profesor:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [usuario, uid]);

  function estudianteDe(asig: Asignacion): Estudiante | undefined {
    return estudiantes.find((e) => e.id === asig.estudianteId);
  }

  async function cambiarEstado() {
    if (!profesor || actualizando) return;
    setActualizando(true);
    try {
      await updateDoc(doc(db, "usuarios", profesor.uid), { activo: !profesor.activo });
      setProfesor({ ...profesor, activo: !profesor.activo });
    } finally {
      setActualizando(false);
    }
  }

  if (usuario && !tieneAccesoGlobal) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No pudimos cargar este profesor supervisor</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Ocurrió un problema de conexión. Intenta de nuevo.</p>
          <Link href="/dashboard/profesores" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver a profesores
          </Link>
        </div>
      </div>
    );
  }

  if (noEncontrado || !profesor) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Profesor supervisor no encontrado</p>
          <Link href="/dashboard/profesores" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver a profesores
          </Link>
        </div>
      </div>
    );
  }

  const asignacionesDeEsteProfesor = asignaciones.filter((a) => a.profesorSupervisorId === profesor.uid);
  const asignacionesVigentes = asignacionesDeEsteProfesor.filter((a) => a.estado === "asignada" || a.estado === "activa");
  const asignacionesHistoricas = asignacionesDeEsteProfesor.filter((a) => a.estado === "finalizada" || a.estado === "cancelada");

  /** Centros donde supervisa hoy, con cuántos estudiantes en cada uno. Se
   * deriva de las asignaciones vigentes: no es un dato guardado aparte que
   * pueda quedar desactualizado. */
  const centrosSupervisados = Array.from(
    asignacionesVigentes.reduce((mapa, a) => {
      mapa.set(a.centroDualId, (mapa.get(a.centroDualId) ?? 0) + 1);
      return mapa;
    }, new Map<string, number>())
  )
    .map(([id, cuantos]) => ({ centro: centros.find((c) => c.id === id), cuantos }))
    .filter((x): x is { centro: CentroDual; cuantos: number } => Boolean(x.centro));

  // "finalizada" y "cancelada" ya pasaron; el resto sigue por delante.
  const visitasPendientes = visitas.filter((v) => {
    const e = estadoCanonico(v.estado);
    return e !== "finalizada" && e !== "cancelada";
  }).length;

  const direccionCompleta = [
    [profesor.direccion, profesor.numeroDireccion].filter(Boolean).join(" "),
    profesor.depto,
    profesor.ciudad,
  ].filter((t) => t && String(t).trim()).join(", ");

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">{profesor.nombre}</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{profesor.especialidad || "Sin especialidad registrada"}</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span style={{ color: profesor.activo ? "var(--success)" : "var(--text-muted)", background: (profesor.activo ? "var(--success)" : "var(--text-muted)") + "22" }} className="px-3 py-1.5 rounded-full text-sm font-medium">
          {profesor.activo ? "Activo" : "Inactivo"}
        </span>
        {puedeGestionar && (
          <>
            <Link href={`/dashboard/profesores/${profesor.uid}/editar`} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent-light)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors">
              <Pencil size={13} />
              Editar
            </Link>
            <button onClick={cambiarEstado} disabled={actualizando} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50">
              <Power size={13} />
              {profesor.activo ? "Marcar inactivo" : "Marcar activo"}
            </button>
          </>
        )}
      </div>

      {/* Lo que se quiere saber de un vistazo antes de leer el detalle. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Cifra icono={<Users size={15} />} valor={asignacionesVigentes.length} etiqueta="Estudiantes a cargo" />
        <Cifra icono={<Building2 size={15} />} valor={centrosSupervisados.length} etiqueta="Centros Duales" />
        <Cifra icono={<MapPin size={15} />} valor={visitas.length} etiqueta={visitasPendientes > 0 ? `Visitas · ${visitasPendientes} pendiente(s)` : "Visitas"} />
        <Cifra icono={<ClipboardCheck size={15} />} valor={evaluaciones.length} etiqueta="Evaluaciones firmadas" />
      </div>

      <Bloque titulo="Identificación">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="RUT" valor={profesor.run || "No registrado"} />
          <Dato label="Especialidad" valor={profesor.especialidad || "No registrada"} />
          <Dato label="Fecha de nacimiento" valor={profesor.fechaNacimiento ? formatearFecha(profesor.fechaNacimiento) : "No registrada"} />
          <Dato label="Nacionalidad" valor={profesor.nacionalidad || "No registrada"} />
          <Dato label="Establecimiento" valor={liceo?.nombre || "—"} />
          <Dato label="En SIGEDUAL desde" valor={profesor.creadoEn ? formatearFecha(profesor.creadoEn) : "No registrada"} />
        </div>
      </Bloque>

      <Bloque titulo="Contacto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Correo" valor={profesor.email} />
          <Dato label="Teléfono" valor={profesor.telefono || "No registrado"} />
          <Dato label="Teléfono secundario" valor={profesor.telefonoSecundario || "No registrado"} />
          <Dato
            label="Dirección"
            valor={direccionCompleta || "No registrada"}
          />
          <Dato label="Comuna" valor={profesor.comuna || "No registrada"} />
          <Dato label="Región" valor={profesor.region || "No registrada"} />
        </div>
        {/* El propio profesor completa estos datos desde Administración →
            Usuario; desde acá no se editan. */}
        {!profesor.telefono && !profesor.comuna && (
          <p style={{ color: "var(--text-muted)" }} className="text-xs mt-4">
            Estos datos los completa el propio profesor desde Administración → Usuario.
          </p>
        )}
      </Bloque>

      {profesor.descripcion?.trim() && (
        <Bloque titulo="Sobre el profesor supervisor">
          <p style={{ color: "var(--text-secondary)" }} className="text-sm whitespace-pre-wrap">{profesor.descripcion}</p>
        </Bloque>
      )}

      <Bloque titulo="Centros Duales donde supervisa">
        {centrosSupervisados.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">
            Todavía no supervisa a nadie en ningún Centro Dual.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {centrosSupervisados.map(({ centro, cuantos }) => (
              <Link
                key={centro.id}
                href={`/dashboard/centros/${centro.id}`}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:[border-color:var(--accent)] transition-colors"
              >
                <div className="min-w-0">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{centro.nombre}</p>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                    {[centro.comuna, centro.region].filter(Boolean).join(" · ") || "Sin ubicación registrada"}
                  </p>
                </div>
                <span style={{ color: "var(--text-secondary)" }} className="text-xs flex-shrink-0">
                  {cuantos} estudiante(s)
                </span>
              </Link>
            ))}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Estudiantes asignados" id="estudiantes">
        {asignacionesVigentes.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Este profesor supervisor no tiene estudiantes asignados actualmente.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {asignacionesVigentes.map((a) => {
              const est = estudianteDe(a);
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/estudiantes/asignaciones/${a.id}`}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:[border-color:var(--accent)] transition-colors"
                >
                  <div className="min-w-0">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{est ? `${est.nombres} ${est.apellidos}` : "Estudiante no encontrado"}</p>
                    <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{est?.curso || "Sin curso"} · Asignado desde: {a.fechaInicio ? formatearFecha(a.fechaInicio) : "No definida"}</p>
                  </div>
                  <span style={{ color: "var(--text-secondary)" }} className="text-xs flex-shrink-0">{ESTADO_ASIGNACION_LABEL[a.estado]}</span>
                </Link>
              );
            })}
          </div>
        )}
      </Bloque>

      {asignacionesHistoricas.length > 0 && (
        <Bloque titulo="Historial">
          <div className="flex flex-col gap-2">
            {asignacionesHistoricas.map((a) => {
              const est = estudianteDe(a);
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/estudiantes/asignaciones/${a.id}`}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:[border-color:var(--accent)] transition-colors"
                >
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{est ? `${est.nombres} ${est.apellidos}` : "Estudiante no encontrado"}</p>
                  <span style={{ color: "var(--text-muted)" }} className="text-xs flex-shrink-0">{ESTADO_ASIGNACION_LABEL[a.estado]}</span>
                </Link>
              );
            })}
          </div>
        </Bloque>
      )}

      <Bloque titulo="Visitas" id="visitas">
        {visitas.length === 0 ? (
          <div className="flex items-start gap-2">
            <MapPin size={15} style={{ color: "var(--text-muted)" }} className="flex-shrink-0 mt-0.5" />
            <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin visitas registradas para este profesor supervisor.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...visitas]
              .sort((a, b) => fechaProgramadaDe(b).localeCompare(fechaProgramadaDe(a)))
              .map((v) => {
                const centro = centros.find((c) => c.id === v.centroDualId);
                const estado = estadoCanonico(v.estado);
                return (
                  <Link
                    key={v.id}
                    href={`/dashboard/visitas/${v.id}`}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:[border-color:var(--accent)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{centro?.nombre || "Centro dual no encontrado"}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">{formatearFecha(fechaProgramadaDe(v))}</p>
                    </div>
                    <span style={{ color: ESTADO_VISITA_COLOR[estado], background: ESTADO_VISITA_COLOR[estado] + "22" }} className="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0">
                      {ESTADO_VISITA_LABEL[estado]}
                    </span>
                  </Link>
                );
              })}
          </div>
        )}
      </Bloque>

      {/* No son evaluaciones AL profesor: son las que el profesor firmó
          sobre sus estudiantes. SIGEDUAL no evalúa a los profesores. */}
      <Bloque titulo="Evaluaciones que ha firmado" id="evaluaciones">
        {evaluaciones.length === 0 ? (
          <div className="flex items-start gap-2">
            <ClipboardCheck size={15} style={{ color: "var(--text-muted)" }} className="flex-shrink-0 mt-0.5" />
            <p style={{ color: "var(--text-secondary)" }} className="text-sm">Todavía no ha firmado ninguna evaluación.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...evaluaciones]
              .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
              .slice(0, 10)
              .map((ev) => {
                const est = estudiantes.find((e) => e.id === ev.estudianteId);
                return (
                  <div
                    key={ev.id}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                  >
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">
                      {est ? `${est.nombres} ${est.apellidos}` : "Estudiante no encontrado"}
                    </p>
                    <span style={{ color: "var(--text-muted)" }} className="text-xs flex-shrink-0">
                      {ev.fecha ? formatearFecha(ev.fecha) : "Sin fecha"}
                    </span>
                  </div>
                );
              })}
            {evaluaciones.length > 10 && (
              <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
                Mostrando las 10 más recientes de {evaluaciones.length}.
              </p>
            )}
          </div>
        )}
      </Bloque>
    </div>
  );
}
