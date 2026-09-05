"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizarRut } from "@/lib/rut";
import { sincronizarIndiceRunEstudiante } from "@/lib/estudiantes/indiceRun";
import EstudianteForm, { ESTUDIANTE_FORM_VACIO, type EstudianteFormValues } from "../_components/EstudianteForm";
import InvitacionEstudianteSeccion from "../_components/InvitacionEstudianteSeccion";
import TituloPagina from "@/components/TituloPagina";
import type { Estudiante, Especialidad } from "@/types";
import { usePreferencias } from "@/lib/preferencias/context";
import { useBorradorAutomatico } from "@/lib/borradores/useBorradorAutomatico";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import { Users, UserPlus, CalendarClock, BadgeCheck, CheckCircle2, Eye, FileClock } from "lucide-react";

interface BorradorEstudiante {
  form: EstudianteFormValues;
  otrosMedicos: string[];
  rasgos: string[];
  habilidades: string[];
}

const ANIO_ACTUAL = new Date().getFullYear();

export default function AgregarEstudiantePage() {
  const { usuario } = useAuth();
  const { preferencias } = usePreferencias();
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();
  const router = useRouter();
  const { guardar: guardarBorrador, restaurar: restaurarBorrador, limpiar: limpiarBorrador, borradorDisponible } =
    useBorradorAutomatico<BorradorEstudiante>("estudiantes-nuevo", preferencias.borradoresAutomaticos);
  const [valoresFormulario, setValoresFormulario] = useState<EstudianteFormValues>(ESTUDIANTE_FORM_VACIO);
  const [formularioKey, setFormularioKey] = useState(0);
  const [avisoBorrador, setAvisoBorrador] = useState(true);

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [registrado, setRegistrado] = useState<Estudiante | null>(null);

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setCargandoDatos(true);
      const [snapEst, snapEsp] = await Promise.all([
        getDocs(query(collection(db, "estudiantes"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      setEstudiantes(snapEst.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setCargandoDatos(false);
    }
    cargar();
  }, [usuario]);

  const stats = useMemo(() => {
    const agregadosEsteAnio = estudiantes.filter((e) => new Date(e.creadoEn).getFullYear() === ANIO_ACTUAL).length;
    const activos = estudiantes.filter((e) => e.estado === "activo").length;
    const ultimo = [...estudiantes].sort((a, b) => (b.creadoEn > a.creadoEn ? 1 : -1))[0];
    let ultimoTexto = "Sin registros";
    if (ultimo) {
      const dias = Math.floor((Date.now() - new Date(ultimo.creadoEn).getTime()) / 86400000);
      ultimoTexto = dias <= 0 ? "Hoy" : dias === 1 ? "Hace 1 día" : `Hace ${dias} días`;
    }
    return { total: estudiantes.length, agregadosEsteAnio, activos, ultimoTexto };
  }, [estudiantes]);

  const runsOcupados = useMemo(() => estudiantes.map((e) => e.run), [estudiantes]);

  async function guardar(form: EstudianteFormValues, otrosMedicos: string[], rasgos: string[], habilidades: string[]) {
    if (!usuario || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const nuevo = {
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
        liceoId: usuario.liceoId,
        profesorId: usuario.uid,
        estado: form.estado,
        enfermedadesCronicas: form.enfermedadesCronicas.trim(),
        alergias: form.alergias.trim(),
        informacionMedicaAdicional: otrosMedicos.map((v) => v.trim()).filter(Boolean),
        rasgos,
        habilidades,
        apoderadoNombre: form.apoderadoNombre.trim(),
        apoderadoRun: form.apoderadoRun.trim() ? normalizarRut(form.apoderadoRun) : "",
        apoderadoParentesco: form.apoderadoParentesco,
        apoderadoTelefono: form.apoderadoTelefono.trim(),
        apoderadoEmail: form.apoderadoEmail.trim(),
        apoderadoDomicilio: form.apoderadoDomicilio.trim(),
        apoderadoCiudad: form.apoderadoCiudad.trim(),
        observaciones: form.observaciones.trim(),
        creadoEn: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "estudiantes"), nuevo);
      await sincronizarIndiceRunEstudiante(ref.id, usuario.liceoId, nuevo.run);
      setRegistrado({ id: ref.id, ...nuevo } as Estudiante);
      limpiarBorrador();
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible registrar al estudiante. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <TituloPagina icon={<UserPlus size={28} />}>Agregar estudiante</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Registra un nuevo estudiante en SIGEDUAL y completa su información académica.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Estudiantes registrados", value: stats.total, icon: <Users size={18} />, color: "#2563eb" },
          { label: "Agregados este año", value: stats.agregadosEsteAnio, icon: <UserPlus size={18} />, color: "#22c55e" },
          { label: "Estudiantes activos", value: stats.activos, icon: <BadgeCheck size={18} />, color: "#06b6d4" },
          { label: "Último registro", value: stats.ultimoTexto, icon: <CalendarClock size={18} />, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 flex flex-col gap-3">
            <div style={{ background: "var(--accent)", borderRadius: 999 }} className="w-9 h-9 flex items-center justify-center">
              <span style={{ color: "var(--text-on-accent)" }}>{s.icon}</span>
            </div>
            <div>
              <p style={{ color: "var(--text-primary)" }} className="text-lg font-bold leading-tight">
                {cargandoDatos ? "—" : s.value}
              </p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {!cargandoDatos && especialidades.length === 0 && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }} className="rounded-xl px-4 py-3 mb-6 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p style={{ color: "var(--warning)" }} className="text-sm font-medium">
            Tu liceo aún no tiene especialidades registradas. Necesitas agregar al menos una (ej: &quot;Contabilidad&quot;) antes de poder registrar estudiantes.
          </p>
          <Link
            href="/dashboard/especialidades"
            style={{ background: "var(--warning)", color: "#1a1300" }}
            className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity flex-shrink-0 text-center"
          >
            Agregar especialidad
          </Link>
        </div>
      )}

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {avisoBorrador && borradorDisponible && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl px-4 py-3 mb-6 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <span className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <FileClock size={16} style={{ color: "var(--accent-light)" }} />
            Tienes un borrador guardado automáticamente de un registro sin terminar.
          </span>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => {
                const borrador = restaurarBorrador();
                if (borrador) {
                  setValoresFormulario(borrador.form);
                  setFormularioKey((k) => k + 1);
                }
                setAvisoBorrador(false);
              }}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              Restaurar borrador
            </button>
            <button
              onClick={() => { limpiarBorrador(); setAvisoBorrador(false); }}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {!cargandoDatos && (
        <EstudianteForm
          key={formularioKey}
          modo="crear"
          valoresIniciales={valoresFormulario}
          otrosMedicosIniciales={[]}
          rasgosIniciales={[]}
          habilidadesIniciales={[]}
          especialidades={especialidades}
          runsOcupados={runsOcupados}
          guardando={guardando}
          onCancelar={() => router.push("/dashboard/estudiantes")}
          onGuardar={(form, otrosMedicos, rasgos, habilidades) => conConfirmacion(() => guardar(form, otrosMedicos, rasgos, habilidades))}
          onCambio={(form, otrosMedicos, rasgos, habilidades) => guardarBorrador({ form, otrosMedicos, rasgos, habilidades })}
        />
      )}

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="un estudiante" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}

      <InvitacionEstudianteSeccion />

      {/* Confirmación de éxito */}
      {registrado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl text-center">
            <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
            </div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Estudiante agregado correctamente</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-5">El registro ya está disponible en el sistema.</p>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 text-left text-sm flex flex-col gap-1.5 mb-6">
              <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Nombre: </span>{registrado.nombres} {registrado.apellidos}</p>
              <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>RUN: </span>{registrado.run}</p>
              <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Curso: </span>{registrado.curso || "—"}</p>
              <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Especialidad: </span>{especialidades.find((e) => e.id === registrado.especialidadId)?.nombre || "—"}</p>
              <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Estado: </span><span className="capitalize">{registrado.estado}</span></p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRegistrado(null)}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              >
                Agregar otro
              </button>
              <Link
                href={`/dashboard/estudiantes/${registrado.id}`}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Eye size={15} />
                Ver estudiante
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
