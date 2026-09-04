"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { disponibilidadMaestroGuiaDe, camposFaltantesMaestroGuia } from "@/lib/maestro-guia";
import { formatearFecha } from "@/lib/fecha";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import type { Asignacion, CentroDual, EstadoAsignacion, Especialidad, Estudiante, MaestroGuia } from "@/types";
import { AlertCircle, ArrowLeft, Pencil, Power, Trash2, ShieldAlert, KeyRound, CheckCircle2 } from "lucide-react";

const ESTADO_ASIGNACION_LABEL: Record<EstadoAsignacion, string> = {
  pendiente: "Pendiente", en_proceso: "En proceso", asignada: "Asignada",
  activa: "Activa", finalizada: "Finalizada", cancelada: "Cancelada",
};

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-5">
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-4">{titulo}</p>
      {children}
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

export default function FichaMaestroGuiaPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const [mg, setMg] = useState<MaestroGuia | null>(null);
  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [denegado, setDenegado] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [cuentaVinculada, setCuentaVinculada] = useState<{ email: string } | null | undefined>(undefined);
  const [mostrarCrearAcceso, setMostrarCrearAcceso] = useState(false);
  const [emailAcceso, setEmailAcceso] = useState("");
  const [passwordAcceso, setPasswordAcceso] = useState("");
  const [creandoAcceso, setCreandoAcceso] = useState(false);
  const [errorAcceso, setErrorAcceso] = useState("");

  const puedeEditar = Boolean(usuario && (usuario.rol === "administrador" || usuario.rol === "profesor"));
  const puedeEliminar = usuario?.rol === "administrador" || usuario?.rol === "coordinador" || usuario?.rol === "director";
  const ambito = useAmbitoProfesor();

  useEffect(() => {
    if (!usuario || !id) return;
    if (usuario.rol === "profesor" && ambito.cargando) return;
    if (usuario.rol === "profesor" && !ambito.idsMaestros.includes(id)) {
      setDenegado(true);
      setLoading(false);
      registrarEvento({
        uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
        accion: "ver_maestro_guia", recurso: "maestros_guia", recursoId: id,
        resultado: "denegado", detalle: "Maestro guía fuera del ámbito autorizado del profesor.",
      });
      return;
    }
    async function cargar() {
      setLoading(true);
      setError(false);
      try {
        const snapMg = await getDoc(doc(db, "maestros_guia", id));
        if (!snapMg.exists()) {
          setNoEncontrado(true);
          setLoading(false);
          return;
        }
        const m = { id: snapMg.id, ...snapMg.data() } as MaestroGuia;
        setMg(m);

        const [snapCentro, snapEsp] = await Promise.all([
          m.centroDualId ? getDoc(doc(db, "centros_duales", m.centroDualId)) : Promise.resolve(null),
          getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        ]);
        if (snapCentro?.exists()) setCentro({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
        setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));

        if (puedeEditar) {
          const snapCuenta = await getDocs(query(collection(db, "usuarios"), where("maestroGuiaId", "==", id), limit(1)));
          setCuentaVinculada(snapCuenta.empty ? null : { email: snapCuenta.docs[0].data().email as string });
        }

        if (usuario!.rol === "profesor") {
          const asigDeEsteGuia = ambito.asignaciones.filter((a) => a.maestroGuiaId === id);
          setAsignaciones(asigDeEsteGuia);
          setEstudiantes(await obtenerDocumentosPorId<Estudiante>("estudiantes", asigDeEsteGuia.map((a) => a.estudianteId)));
        } else {
          const [snapAsig, snapEst] = await Promise.all([
            getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId))),
            getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
          ]);
          setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
          setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
        }
      } catch (err) {
        console.error("Error al cargar ficha de maestro guía:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id, ambito.cargando, ambito.idsMaestros, ambito.asignaciones]);

  function especialidadNombre(espId: string): string {
    return especialidades.find((e) => e.id === espId)?.nombre || espId;
  }

  function estudianteDe(asig: Asignacion): Estudiante | undefined {
    return estudiantes.find((e) => e.id === asig.estudianteId);
  }

  async function cambiarEstado() {
    if (!mg || actualizando) return;
    setActualizando(true);
    try {
      const nuevoEstado = mg.estado === "activo" ? "inactivo" : "activo";
      await updateDoc(doc(db, "maestros_guia", mg.id), { estado: nuevoEstado, actualizadoEn: new Date().toISOString() });
      setMg({ ...mg, estado: nuevoEstado });
    } finally {
      setActualizando(false);
    }
  }

  async function crearAcceso() {
    if (!mg || !usuario || creandoAcceso) return;
    if (!emailAcceso.trim() || passwordAcceso.length < 6) {
      setErrorAcceso("Ingresa un correo válido y una contraseña de al menos 6 caracteres.");
      return;
    }
    setCreandoAcceso(true);
    setErrorAcceso("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailAcceso.trim(), passwordAcceso);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        uid: cred.user.uid,
        email: emailAcceso.trim(),
        nombre: `${mg.nombres} ${mg.apellidoPaterno} ${mg.apellidoMaterno ?? ""}`.trim(),
        rol: "centro_dual",
        maestroGuiaId: mg.id,
        centroDualId: mg.centroDualId,
        liceoId: usuario.liceoId,
        activo: true,
        creadoEn: new Date().toISOString(),
      });
      setCuentaVinculada({ email: emailAcceso.trim() });
      setMostrarCrearAcceso(false);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setErrorAcceso(code === "auth/email-already-in-use" ? "Ya existe una cuenta con ese correo." : "No fue posible crear el acceso. Intenta nuevamente.");
    } finally {
      setCreandoAcceso(false);
    }
  }

  async function eliminar() {
    if (!mg || eliminando) return;
    if (!confirm(`¿Eliminar a ${mg.nombres} ${mg.apellidoPaterno} como maestro guía? Esta acción no se puede deshacer.`)) return;
    setEliminando(true);
    try {
      await deleteDoc(doc(db, "maestros_guia", mg.id));
      router.replace("/dashboard/centros/maestros");
    } finally {
      setEliminando(false);
    }
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
          <AlertCircle size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No pudimos cargar este maestro guía</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Ocurrió un problema de conexión. Intenta de nuevo.</p>
          <Link href="/dashboard/centros/maestros" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver a maestros guía
          </Link>
        </div>
      </div>
    );
  }

  if (denegado) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <ShieldAlert size={22} style={{ color: "var(--text-muted)" }} className="mx-auto mb-3" />
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Acceso denegado</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Este maestro guía no está dentro de tu ámbito autorizado.</p>
          <Link href="/dashboard/centros/maestros" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <ArrowLeft size={16} />
            Volver a maestros guía
          </Link>
        </div>
      </div>
    );
  }

  if (noEncontrado || !mg) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Maestro guía no encontrado</p>
          <Link href="/dashboard/centros/maestros" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver a maestros guía
          </Link>
        </div>
      </div>
    );
  }

  const disponibilidad = disponibilidadMaestroGuiaDe(mg, asignaciones);
  const asignacionesDeEsteGuia = asignaciones.filter((a) => a.maestroGuiaId === mg.id);
  const asignacionesVigentes = asignacionesDeEsteGuia.filter((a) => a.estado === "asignada" || a.estado === "activa");
  const asignacionesHistoricas = asignacionesDeEsteGuia.filter((a) => a.estado === "finalizada" || a.estado === "cancelada");
  const faltantes = camposFaltantesMaestroGuia(mg, Boolean(centro));

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">{mg.nombres} {mg.apellidoPaterno} {mg.apellidoMaterno}</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          {centro ? <>Maestro guía en <Link href={`/dashboard/centros/${centro.id}`} style={{ color: "var(--accent-light)" }} className="hover:underline">{centro.nombre}</Link></> : "Centro no encontrado"}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span style={{ color: mg.estado === "activo" ? "var(--success)" : "var(--danger)", background: (mg.estado === "activo" ? "var(--success)" : "var(--danger)") + "22" }} className="px-3 py-1.5 rounded-full text-sm font-medium">
          {mg.estado === "activo" ? "Activo" : "Inactivo"}
        </span>
        {puedeEditar && (
          <>
            <Link href={`/dashboard/centros/maestros/${mg.id}/editar`} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent-light)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors">
              <Pencil size={13} />
              Editar
            </Link>
            <button onClick={cambiarEstado} disabled={actualizando} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50">
              <Power size={13} />
              {mg.estado === "activo" ? "Marcar inactivo" : "Marcar activo"}
            </button>
            {puedeEliminar && asignacionesDeEsteGuia.length === 0 && (
              <button onClick={eliminar} disabled={eliminando} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--danger)" }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:[border-color:var(--danger)] transition-colors disabled:opacity-50">
                <Trash2 size={13} />
                Eliminar
              </button>
            )}
          </>
        )}
      </div>

      {puedeEliminar && asignacionesDeEsteGuia.length > 0 && (
        <p style={{ color: "var(--text-muted)" }} className="text-xs -mt-4 mb-6">
          No se puede eliminar: tiene historial de asignaciones. Usa &quot;Marcar inactivo&quot; para desvincularlo conservando el historial.
        </p>
      )}

      {faltantes.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
          <AlertCircle size={15} style={{ color: "var(--text-muted)" }} className="flex-shrink-0 mt-0.5" />
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">
            <span style={{ color: "var(--text-primary)" }} className="font-medium">Información incompleta. </span>
            Falta: {faltantes.join(", ")}.
          </p>
        </div>
      )}

      {puedeEditar && cuentaVinculada !== undefined && (
        <Bloque titulo="Cuenta de acceso">
          {cuentaVinculada ? (
            <p style={{ color: "var(--text-secondary)" }} className="text-sm flex items-center gap-2">
              <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
              Este maestro guía puede iniciar sesión con <strong style={{ color: "var(--text-primary)" }}>{cuentaVinculada.email}</strong>.
            </p>
          ) : (
            <>
              <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-3">
                Este maestro guía todavía no tiene una cuenta para iniciar sesión en SIGEDUAL (por ejemplo, para realizar evaluaciones de sus estudiantes).
              </p>
              <button
                onClick={() => setMostrarCrearAcceso(true)}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"
              >
                <KeyRound size={14} /> Crear acceso
              </button>
            </>
          )}
        </Bloque>
      )}

      <Bloque titulo="Información personal">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="RUT" valor={mg.run} />
          <Dato label="Correo" valor={mg.email} />
          <Dato label="Teléfono" valor={mg.telefono} />
        </div>
      </Bloque>

      <Bloque titulo="Información profesional">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Cargo" valor={mg.cargo} />
          <Dato label="Área" valor={mg.area || "No registrada"} />
          <Dato label="Años de experiencia" valor={mg.aniosExperiencia != null ? mg.aniosExperiencia : "No registrados"} />
        </div>
      </Bloque>

      <Bloque titulo="Especialidades que puede guiar">
        {(mg.especialidades ?? []).length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin especialidades registradas</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(mg.especialidades ?? []).map((espId) => (
              <span key={espId} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">
                {especialidadNombre(espId)}
              </span>
            ))}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Áreas que puede supervisar">
        {(mg.areasSupervision ?? []).length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Sin áreas registradas</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(mg.areasSupervision ?? []).map((a) => (
              <span key={a} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-2.5 py-1 rounded-full text-xs">{a}</span>
            ))}
          </div>
        )}
      </Bloque>

      <Bloque titulo="Capacidad de acompañamiento">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dato label="Máximo de estudiantes" valor={disponibilidad.capacidad != null ? disponibilidad.capacidad : "Sin límite definido"} />
          <Dato label="Asignados" valor={disponibilidad.asignados} />
          <Dato label="Disponibles" valor={disponibilidad.disponibles != null ? disponibilidad.disponibles : "Sin límite definido"} />
        </div>
      </Bloque>

      <Bloque titulo="Estudiantes asignados">
        {asignacionesVigentes.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Este maestro guía no tiene estudiantes asignados actualmente.</p>
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

      {mg.observaciones && (
        <Bloque titulo="Observaciones">
          <p style={{ color: "var(--text-primary)" }} className="text-sm">{mg.observaciones}</p>
        </Bloque>
      )}

      {mostrarCrearAcceso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setMostrarCrearAcceso(false)}>
          <div
            role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
          >
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Crear acceso</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
              Se creará una cuenta con rol Centro Dual / Maestro Guía, vinculada a {mg.nombres} {mg.apellidoPaterno}. Comparte el correo y la contraseña con él o ella.
            </p>
            {errorAcceso && (
              <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-3 py-2 mb-3">
                <p style={{ color: "var(--danger)" }} className="text-xs font-medium">{errorAcceso}</p>
              </div>
            )}
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Correo electrónico</label>
                <input
                  type="email" value={emailAcceso} onChange={(e) => setEmailAcceso(e.target.value)}
                  placeholder={mg.email || "correo@empresa.cl"}
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
                />
              </div>
              <div>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Contraseña inicial</label>
                <input
                  type="password" value={passwordAcceso} onChange={(e) => setPasswordAcceso(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMostrarCrearAcceso(false)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">
                Cancelar
              </button>
              <button onClick={crearAcceso} disabled={creandoAcceso} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                {creandoAcceso ? "Creando..." : "Crear acceso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
