"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizarRut } from "@/lib/rut";
import EstudianteForm, { type EstudianteFormValues } from "../../_components/EstudianteForm";
import type { Estudiante, Especialidad, Liceo } from "@/types";
import { ArrowLeft, Pencil, School } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

export default function EditarEstudiantePage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const [estudianteOriginal, setEstudianteOriginal] = useState<Estudiante | null>(null);
  const [valores, setValores] = useState<EstudianteFormValues | null>(null);
  const [otrosMedicos, setOtrosMedicos] = useState<string[]>([]);
  const [rasgos, setRasgos] = useState<string[]>([]);
  const [habilidades, setHabilidades] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [runsOcupados, setRunsOcupados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [liceos, setLiceos] = useState<Liceo[]>([]);
  const [liceoSeleccionado, setLiceoSeleccionado] = useState("");
  const [cambiandoLiceo, setCambiandoLiceo] = useState(false);
  const [mensajeLiceo, setMensajeLiceo] = useState("");

  const puedeEditar = usuario?.rol === "administrador" || usuario?.rol === "profesor";
  const esAdministrador = usuario?.rol === "administrador";

  useEffect(() => {
    if (!usuario || !id || !puedeEditar) return;
    async function cargar() {
      setLoading(true);
      const [snapEst, snapEsp, snapTodos] = await Promise.all([
        getDoc(doc(db, "estudiantes", id)),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      if (!snapEst.exists()) {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const e = { id: snapEst.id, ...snapEst.data() } as Estudiante;
      setEstudianteOriginal(e);
      setLiceoSeleccionado(e.liceoId);
      const s = (v: unknown) => (v == null ? "" : String(v));
      setValores({
        run: s(e.run), nombres: s(e.nombres),
        apellidoPaterno: s(e.apellidoPaterno), apellidoMaterno: s(e.apellidoMaterno),
        fechaNacimiento: s(e.fechaNacimiento), sexo: s(e.sexo), nacionalidad: s(e.nacionalidad),
        email: s(e.email), telefono: s(e.telefono), direccion: s(e.direccion),
        comuna: s(e.comuna), ciudad: s(e.ciudad),
        anioAcademico: e.anioAcademico != null ? s(e.anioAcademico) : String(new Date(e.creadoEn).getFullYear()),
        nivel: s(e.nivel), curso: s(e.curso), especialidadId: s(e.especialidadId),
        jornada: s(e.jornada), estado: e.estado ?? "activo",
        enfermedadesCronicas: s(e.enfermedadesCronicas), alergias: s(e.alergias),
        apoderadoNombre: s(e.apoderadoNombre), apoderadoRun: s(e.apoderadoRun),
        apoderadoParentesco: s(e.apoderadoParentesco), apoderadoTelefono: s(e.apoderadoTelefono),
        apoderadoEmail: s(e.apoderadoEmail),
        apoderadoDomicilio: s(e.apoderadoDomicilio), apoderadoCiudad: s(e.apoderadoCiudad),
        observaciones: e.observaciones ?? "",
      });
      setOtrosMedicos(e.informacionMedicaAdicional ?? []);
      setRasgos(e.rasgos ?? []);
      setHabilidades(e.habilidades ?? []);
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setRunsOcupados(
        snapTodos.docs
          .filter((d) => d.id !== id)
          .map((d) => (d.data() as Estudiante).run)
      );
      setLoading(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id, puedeEditar]);

  useEffect(() => {
    if (!esAdministrador) return;
    getDocs(collection(db, "liceos")).then((snap) => {
      setLiceos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Liceo)));
    });
  }, [esAdministrador]);

  async function cambiarLiceo() {
    if (!liceoSeleccionado || !estudianteOriginal || cambiandoLiceo) return;
    setCambiandoLiceo(true);
    setMensajeLiceo("");
    try {
      await updateDoc(doc(db, "estudiantes", id), { liceoId: liceoSeleccionado, actualizadoEn: new Date().toISOString() });
      setEstudianteOriginal({ ...estudianteOriginal, liceoId: liceoSeleccionado });
      setMensajeLiceo("Liceo actualizado correctamente.");
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setMensajeLiceo(`No se pudo cambiar el liceo. (${detalle})`);
    } finally {
      setCambiandoLiceo(false);
    }
  }

  const runsOcupadosMemo = useMemo(() => runsOcupados, [runsOcupados]);

  async function guardar(form: EstudianteFormValues, nuevosOtrosMedicos: string[], nuevosRasgos: string[], nuevasHabilidades: string[]) {
    if (!usuario || !id || !estudianteOriginal || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    setMensaje("");
    try {
      await updateDoc(doc(db, "estudiantes", id), {
        run: normalizarRut(form.run),
        nombres: form.nombres.trim(),
        apellidos: `${form.apellidoPaterno.trim()} ${form.apellidoMaterno.trim()}`.trim(),
        apellidoPaterno: form.apellidoPaterno.trim(),
        apellidoMaterno: form.apellidoMaterno.trim(),
        fechaNacimiento: form.fechaNacimiento,
        sexo: form.sexo,
        nacionalidad: form.nacionalidad.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        comuna: form.comuna.trim(),
        ciudad: form.ciudad.trim(),
        anioAcademico: form.anioAcademico.trim(),
        nivel: form.nivel,
        curso: form.curso.trim(),
        especialidadId: form.especialidadId,
        jornada: form.jornada,
        estado: form.estado,
        enfermedadesCronicas: form.enfermedadesCronicas.trim(),
        alergias: form.alergias.trim(),
        informacionMedicaAdicional: nuevosOtrosMedicos.map((v) => v.trim()).filter(Boolean),
        rasgos: nuevosRasgos,
        habilidades: nuevasHabilidades,
        apoderadoNombre: form.apoderadoNombre.trim(),
        apoderadoRun: form.apoderadoRun.trim() ? normalizarRut(form.apoderadoRun) : "",
        apoderadoParentesco: form.apoderadoParentesco,
        apoderadoTelefono: form.apoderadoTelefono.trim(),
        apoderadoEmail: form.apoderadoEmail.trim(),
        apoderadoDomicilio: form.apoderadoDomicilio.trim(),
        apoderadoCiudad: form.apoderadoCiudad.trim(),
        observaciones: form.observaciones.trim(),
        actualizadoEn: new Date().toISOString(),
      });
      setMensaje("Cambios guardados correctamente.");
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No se pudieron guardar los cambios. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  if (usuario && !puedeEditar) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  if (loading || !valores) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (noEncontrado) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Estudiante no encontrado</p>
          <Link href="/dashboard/estudiantes" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <TituloPagina icon={<Pencil size={28} />}>Editar estudiante</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Actualiza los datos de {estudianteOriginal?.nombres} {estudianteOriginal?.apellidos}.
        </p>
      </div>

      {mensaje && (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--success)" }} className="text-sm font-medium">{mensaje}</p>
        </div>
      )}
      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {esAdministrador && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <School size={16} style={{ color: "var(--accent-light)" }} />
            <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Liceo asignado</h3>
          </div>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">
            Solo el administrador puede mover un estudiante a otro liceo (ej. si quedó asignado por error).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={liceoSeleccionado}
              onChange={(e) => setLiceoSeleccionado(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
            >
              {liceos.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <button
              onClick={cambiarLiceo}
              disabled={cambiandoLiceo || liceoSeleccionado === estudianteOriginal?.liceoId}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
            >
              {cambiandoLiceo ? "Guardando..." : "Guardar liceo"}
            </button>
          </div>
          {mensajeLiceo && (
            <p style={{ color: mensajeLiceo.startsWith("No se pudo") ? "var(--danger)" : "var(--success)" }} className="text-xs mt-2">{mensajeLiceo}</p>
          )}
        </div>
      )}

      <EstudianteForm
        modo="editar"
        valoresIniciales={valores}
        otrosMedicosIniciales={otrosMedicos}
        rasgosIniciales={rasgos}
        habilidadesIniciales={habilidades}
        especialidades={especialidades}
        runsOcupados={runsOcupadosMemo}
        guardando={guardando}
        onCancelar={() => router.push(`/dashboard/estudiantes/${id}`)}
        onGuardar={guardar}
      />
    </div>
  );
}
