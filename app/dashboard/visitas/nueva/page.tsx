"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import { useAmbitoProfesor } from "@/lib/permisos/useAmbitoProfesor";
import { obtenerDocumentosPorId } from "@/lib/permisos/obtenerDocumentosPorId";
import { registrarEvento } from "@/lib/auditoria/registrarEvento";
import TituloPagina from "@/components/TituloPagina";
import Select from "@/components/ui/Select";
import type { Asignacion, CentroDual, Estudiante, MaestroGuia, Usuario, Visita } from "@/types";
import { MapPin, CheckCircle2, Eye, Wand2 } from "lucide-react";

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors";

export default function AgendarVisitaPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();

  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [maestrosGuia, setMaestrosGuia] = useState<MaestroGuia[]>([]);
  const [profesores, setProfesores] = useState<Usuario[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [centroDualId, setCentroDualId] = useState("");
  const [estudianteIdsSel, setEstudianteIdsSel] = useState<string[]>([]);
  const [maestroGuiaId, setMaestroGuiaId] = useState("");
  const [profesorSupervisorId, setProfesorSupervisorId] = useState("");
  const [direccion, setDireccion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacionesPrevias, setObservacionesPrevias] = useState("");
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [horaProgramada, setHoraProgramada] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [agendada, setAgendada] = useState<Visita | null>(null);

  const esProfesor = usuario?.rol === "profesor";
  const puedeAgregar = ["administrador", "coordinador", "director", "profesor"].includes(usuario?.rol ?? "");
  const ambito = useAmbitoProfesor();

  useEffect(() => {
    if (!usuario) return;
    if (esProfesor && ambito.cargando) return;
    async function cargar() {
      setCargandoDatos(true);
      if (esProfesor) {
        const vigentes = ambito.asignaciones.filter((a) => a.estado === "asignada" || a.estado === "activa");
        const [centrosData, estudiantesData, mgData] = await Promise.all([
          obtenerDocumentosPorId<CentroDual>("centros_duales", ambito.idsCentros),
          obtenerDocumentosPorId<Estudiante>("estudiantes", ambito.idsEstudiantes),
          obtenerDocumentosPorId<MaestroGuia>("maestros_guia", ambito.idsMaestros),
        ]);
        setCentros(centrosData);
        setAsignaciones(vigentes);
        setEstudiantes(estudiantesData);
        setMaestrosGuia(mgData);
        setProfesorSupervisorId(usuario!.uid);
        setCargandoDatos(false);
        return;
      }
      const [snapCentros, snapAsig, snapEst, snapMg, snapProf] = await Promise.all([
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "usuarios"), where("liceoId", "==", usuario!.liceoId), where("rol", "==", "profesor"))),
      ]);
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      const todas = snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion));
      setAsignaciones(todas.filter((a) => a.estado === "asignada" || a.estado === "activa"));
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setMaestrosGuia(snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)));
      setProfesores(snapProf.docs.map((d) => ({ ...d.data() } as Usuario)));
      setCargandoDatos(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, esProfesor, ambito.cargando, ambito.idsCentros, ambito.idsEstudiantes, ambito.idsMaestros, ambito.asignaciones]);

  const asignacionesDelCentro = useMemo(
    () => asignaciones.filter((a) => a.centroDualId === centroDualId),
    [asignaciones, centroDualId]
  );
  const centroSeleccionado = centros.find((c) => c.id === centroDualId) ?? null;
  const maestrosDelCentro = useMemo(() => maestrosGuia.filter((m) => m.centroDualId === centroDualId), [maestrosGuia, centroDualId]);

  function seleccionarCentro(id: string) {
    setCentroDualId(id);
    setEstudianteIdsSel([]);
    setMaestroGuiaId("");
    const centro = centros.find((c) => c.id === id);
    setDireccion(centro?.direccion ?? "");
  }

  function toggleEstudiante(estudianteId: string) {
    setEstudianteIdsSel((sel) => {
      const nuevo = sel.includes(estudianteId) ? sel.filter((s) => s !== estudianteId) : [...sel, estudianteId];
      if (!maestroGuiaId && nuevo.length > 0) {
        const asig = asignacionesDelCentro.find((a) => a.estudianteId === nuevo[0]);
        if (asig?.maestroGuiaId) setMaestroGuiaId(asig.maestroGuiaId);
      }
      return nuevo;
    });
  }

  const puedeGuardar = Boolean(centroDualId && profesorSupervisorId && fechaProgramada);

  async function agendar() {
    if (!usuario || !puedeGuardar || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const nueva: Record<string, unknown> = {
        liceoId: usuario.liceoId,
        centroDualId,
        estudianteIds: estudianteIdsSel,
        profesorSupervisorId,
        fechaProgramada,
        estado: "agendada",
        preguntas: [],
        elementosPersonalizados: [],
        acuerdos: [],
        creadoPor: usuario.uid,
        creadoEn: new Date().toISOString(),
      };
      if (maestroGuiaId) nueva.maestroGuiaId = maestroGuiaId;
      if (direccion.trim()) nueva.direccion = direccion.trim();
      if (motivo.trim()) nueva.motivo = motivo.trim();
      if (observacionesPrevias.trim()) nueva.observacionesPrevias = observacionesPrevias.trim();
      if (horaProgramada) nueva.horaProgramada = horaProgramada;
      const ref = await addDoc(collection(db, "visitas"), nueva);
      registrarEvento({
        uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol, liceoId: usuario.liceoId,
        accion: "agendar_visita", recurso: "visitas", recursoId: ref.id, resultado: "permitido",
      });
      setAgendada({ id: ref.id, ...nueva } as Visita);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible agendar la visita.");
    } finally {
      setGuardando(false);
    }
  }

  if (usuario && !puedeAgregar) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  if (agendada) {
    const nombresEstudiantes = estudianteIdsSel
      .map((id) => estudiantes.find((e) => e.id === id))
      .filter((e): e is Estudiante => Boolean(e))
      .map((e) => `${e.nombres} ${e.apellidos}`)
      .join(", ");
    const maestro = maestrosGuia.find((m) => m.id === maestroGuiaId);
    return (
      <div className="p-4 md:p-8 max-w-lg">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-6 text-center">
          <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
          </div>
          <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-4">Visita agendada</h2>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 text-left text-sm flex flex-col gap-2 mb-6">
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Estudiante(s): </span>{nombresEstudiantes || "Sin estudiante asociado"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Centro Dual: </span>{centroSeleccionado?.nombre}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Maestro Guía: </span>{maestro ? `${maestro.nombres} ${maestro.apellidoPaterno}` : "No definido"}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Profesor Supervisor: </span>{esProfesor ? usuario?.nombre : profesores.find((p) => p.uid === profesorSupervisorId)?.nombre}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Fecha: </span>{fechaProgramada}{horaProgramada ? ` · ${horaProgramada}` : ""}</p>
            <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Estado: </span>Agendada</p>
          </div>
          <div className="flex gap-3">
            <Link href={`/dashboard/visitas/${agendada.id}`} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">
              <Eye size={15} /> Ver visita
            </Link>
            <Link href={`/dashboard/visitas/${agendada.id}?iniciar=1`} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
              <Wand2 size={15} /> Iniciar formulario
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="mb-6">
        <TituloPagina icon={<MapPin size={28} />}>Agendar visita</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Planifica una visita a un centro dual.
        </p>
      </div>

      {error && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Centro dual *</label>
          {!cargandoDatos && centros.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }} className="text-xs">
              No tienes centros duales disponibles para agendar una visita.
            </p>
          ) : (
            <Select
              value={centroDualId}
              onChange={seleccionarCentro}
              ariaLabel="Centro dual"
              disabled={cargandoDatos}
              opciones={[{ value: "", label: "Selecciona un centro" }, ...centros.map((c) => ({ value: c.id, label: c.nombre }))]}
            />
          )}
        </div>

        {centroDualId && (
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estudiante(s)</label>
            {asignacionesDelCentro.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-xs">No hay estudiantes asignados a este centro.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {asignacionesDelCentro.map((a) => {
                  const est = estudiantes.find((e) => e.id === a.estudianteId);
                  const activo = estudianteIdsSel.includes(a.estudianteId);
                  return (
                    <button
                      key={a.estudianteId}
                      type="button"
                      onClick={() => toggleEstudiante(a.estudianteId)}
                      style={{
                        background: activo ? "var(--accent)" : "var(--bg-surface)",
                        border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`,
                        color: activo ? "var(--text-on-accent)" : "var(--text-secondary)",
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    >
                      {est ? `${est.nombres} ${est.apellidos}` : "Estudiante"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {centroDualId && (
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Maestro Guía (opcional)</label>
            <Select
              value={maestroGuiaId}
              onChange={setMaestroGuiaId}
              ariaLabel="Maestro Guía"
              opciones={[{ value: "", label: "Sin definir" }, ...maestrosDelCentro.map((m) => ({ value: m.id, label: `${m.nombres} ${m.apellidoPaterno}` }))]}
            />
          </div>
        )}

        {!esProfesor && (
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Profesor Supervisor responsable *</label>
            <Select
              value={profesorSupervisorId}
              onChange={setProfesorSupervisorId}
              ariaLabel="Profesor Supervisor"
              opciones={[{ value: "", label: "Selecciona un profesor" }, ...profesores.map((p) => ({ value: p.uid, label: p.nombre }))]}
            />
          </div>
        )}

        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Dirección / ubicación (opcional)</label>
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} style={inputStyle} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Fecha programada *</label>
            <input type="date" value={fechaProgramada} onChange={(e) => setFechaProgramada(e.target.value)} style={inputStyle} className={inputClass} />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Hora programada (opcional)</label>
            <input type="time" value={horaProgramada} onChange={(e) => setHoraProgramada(e.target.value)} style={inputStyle} className={inputClass} />
          </div>
        </div>

        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Motivo / objetivo de la visita (opcional)</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} style={inputStyle} className={inputClass} />
        </div>

        <div>
          <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Observaciones previas (opcional)</label>
          <textarea value={observacionesPrevias} onChange={(e) => setObservacionesPrevias(e.target.value)} rows={3} style={inputStyle} className={`${inputClass} resize-none`} />
        </div>

        <div className="flex justify-end mt-2">
          <button
            onClick={() => conConfirmacion(agendar)}
            disabled={!puedeGuardar || guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {guardando ? "Agendando..." : "Agendar visita"}
          </button>
        </div>
      </div>

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="una visita" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}
    </div>
  );
}
