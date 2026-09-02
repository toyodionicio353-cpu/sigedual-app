"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizarRut } from "@/lib/rut";
import EstudianteForm, { type EstudianteFormValues } from "../../_components/EstudianteForm";
import type { Estudiante, Especialidad } from "@/types";
import { ArrowLeft } from "lucide-react";

export default function EditarEstudiantePage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const [estudianteOriginal, setEstudianteOriginal] = useState<Estudiante | null>(null);
  const [valores, setValores] = useState<EstudianteFormValues | null>(null);
  const [otrosMedicos, setOtrosMedicos] = useState<string[]>([]);
  const [rasgos, setRasgos] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [runsOcupados, setRunsOcupados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [mensaje, setMensaje] = useState("");

  const puedeEditar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

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
      setValores({
        run: e.run ?? "", nombres: e.nombres ?? "",
        apellidoPaterno: e.apellidoPaterno ?? "", apellidoMaterno: e.apellidoMaterno ?? "",
        fechaNacimiento: e.fechaNacimiento ?? "", sexo: e.sexo ?? "",
        email: e.email ?? "", telefono: e.telefono ?? "", direccion: e.direccion ?? "",
        comuna: e.comuna ?? "", ciudad: e.ciudad ?? "",
        anioAcademico: e.anioAcademico ?? String(new Date(e.creadoEn).getFullYear()),
        nivel: e.nivel ?? "", curso: e.curso ?? "", especialidadId: e.especialidadId ?? "",
        jornada: e.jornada ?? "", estado: e.estado ?? "activo",
        enfermedadesCronicas: e.enfermedadesCronicas ?? "", alergias: e.alergias ?? "",
        apoderadoNombre: e.apoderadoNombre ?? "", apoderadoRun: e.apoderadoRun ?? "",
        apoderadoParentesco: e.apoderadoParentesco ?? "", apoderadoTelefono: e.apoderadoTelefono ?? "",
        apoderadoEmail: e.apoderadoEmail ?? "", observaciones: e.observaciones ?? "",
      });
      setOtrosMedicos(e.informacionMedicaAdicional ?? []);
      setRasgos(e.rasgos ?? []);
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

  const runsOcupadosMemo = useMemo(() => runsOcupados, [runsOcupados]);

  async function guardar(form: EstudianteFormValues, nuevosOtrosMedicos: string[], nuevosRasgos: string[]) {
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
        apoderadoNombre: form.apoderadoNombre.trim(),
        apoderadoRun: form.apoderadoRun.trim() ? normalizarRut(form.apoderadoRun) : "",
        apoderadoParentesco: form.apoderadoParentesco,
        apoderadoTelefono: form.apoderadoTelefono.trim(),
        apoderadoEmail: form.apoderadoEmail.trim(),
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
          <Link href="/dashboard/estudiantes" style={{ background: "var(--accent-blue)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Editar estudiante</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Actualiza los datos de {estudianteOriginal?.nombres} {estudianteOriginal?.apellidos}.
          </p>
        </div>
        <Link
          href={`/dashboard/estudiantes/${id}`}
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver a la ficha
        </Link>
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

      <EstudianteForm
        modo="editar"
        valoresIniciales={valores}
        otrosMedicosIniciales={otrosMedicos}
        rasgosIniciales={rasgos}
        especialidades={especialidades}
        runsOcupados={runsOcupadosMemo}
        guardando={guardando}
        onCancelar={() => router.push(`/dashboard/estudiantes/${id}`)}
        onGuardar={guardar}
      />
    </div>
  );
}
