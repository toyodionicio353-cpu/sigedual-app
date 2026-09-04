"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  Building2, User2, Sparkles, Users2, ClipboardCheck, CheckCircle2,
  ArrowLeft, ArrowRight, Plus, Trash2, AlertTriangle, Clock, ShieldOff,
} from "lucide-react";
import { formatearRut, validarRut, validarEmail, validarTelefonoChileno } from "@/lib/rut";
import { REGIONES } from "@/app/dashboard/liceos/_components/LiceoForm";
import Select from "@/components/ui/Select";
import type { NecesidadesEmpresa, RespuestaMaestroGuiaInvitacion } from "@/types";

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors disabled:opacity-50";

interface ContextoInvitacion {
  estado: string;
  liceoNombre: string;
  profesorNombre: string;
  especialidadNombre?: string;
  cursos?: string[];
  nombrePreliminar?: string;
}

interface EmpresaForm {
  razonSocial: string; nombreFantasia: string; rut: string; giro: string;
  direccion: string; comuna: string; region: string; telefono: string; email: string;
  sitioWeb: string; contactoNombre: string; contactoCargo: string;
  contactoEmail: string; contactoTelefono: string;
}

interface PerfilForm {
  actividadPrincipal: string; areaTrabajo: string; tipoTareas: string;
  tecnologias: string; herramientas: string; ambienteLaboral: string;
  caracteristicasImportantes: string;
}

interface CapacidadForm {
  cantidadEstudiantes: string; especialidades: string; cursos: string;
  periodo: string; jornada: string; horarios: string; restricciones: string;
}

type MaestroForm = Omit<RespuestaMaestroGuiaInvitacion, "id">;

const EMPRESA_VACIA: EmpresaForm = {
  razonSocial: "", nombreFantasia: "", rut: "", giro: "",
  direccion: "", comuna: "", region: "", telefono: "", email: "",
  sitioWeb: "", contactoNombre: "", contactoCargo: "", contactoEmail: "", contactoTelefono: "",
};

const PERFIL_VACIO: PerfilForm = {
  actividadPrincipal: "", areaTrabajo: "", tipoTareas: "",
  tecnologias: "", herramientas: "", ambienteLaboral: "", caracteristicasImportantes: "",
};

const CAPACIDAD_VACIA: CapacidadForm = {
  cantidadEstudiantes: "", especialidades: "", cursos: "", periodo: "", jornada: "", horarios: "", restricciones: "",
};

const MAESTRO_VACIO: MaestroForm = {
  nombreCompleto: "", run: "", cargo: "", area: "", email: "", telefono: "", experiencia: "", especialidad: "", disponibilidad: "", observaciones: "",
};

const OPCIONES_NIVEL_ACTIVIDAD = [
  { value: "muy_activo", label: "Muy activo (movimiento constante)" },
  { value: "moderado", label: "Moderado" },
  { value: "tranquilo", label: "Tranquilo / de escritorio" },
  { value: "no_determinante", label: "No es un factor determinante" },
];
const OPCIONES_RITMO = [
  { value: "rapido", label: "Rápido, orientado a resultados" },
  { value: "moderado", label: "Moderado" },
  { value: "acompanado", label: "Con acompañamiento cercano" },
];
const OPCIONES_AUTONOMIA = [
  { value: "alta", label: "Alta autonomía" },
  { value: "media", label: "Autonomía media" },
  { value: "supervision_constante", label: "Requiere supervisión constante" },
];
const OPCIONES_ADAPTACION = [
  { value: "alta", label: "Alta" }, { value: "media", label: "Media" }, { value: "baja", label: "Baja" },
];
const OPCIONES_COMUNICACION = [
  { value: "alta_clientes", label: "Alta, con trato a clientes/público" },
  { value: "moderada", label: "Moderada" },
  { value: "interna", label: "Principalmente interna, con el equipo" },
];
const OPCIONES_TRABAJO_EQUIPO = [
  { value: "alto", label: "Alto" }, { value: "medio", label: "Medio" }, { value: "bajo", label: "Bajo" },
];

const PASOS = ["Empresa", "Perfil", "Necesidades", "Capacidad", "Maestros Guía", "Revisión"];

function Pantalla({ icon, titulo, descripcion, tono }: { icon: React.ReactNode; titulo: string; descripcion: string; tono?: "danger" | "warning" }) {
  const color = tono === "danger" ? "var(--danger)" : tono === "warning" ? "var(--warning)" : "var(--accent)";
  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center p-4">
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
        <div style={{ background: `${color}22`, borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
          <span style={{ color }}>{icon}</span>
        </div>
        <h1 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">{titulo}</h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">{descripcion}</p>
      </div>
    </div>
  );
}

function Campo({ label, error, children, span }: { label: string; error?: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">{label}</label>
      {children}
      {error && <p style={{ color: "var(--danger)" }} className="text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function FormularioInvitacionPage() {
  const { token } = useParams<{ token: string }>();

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<{ mensaje: string; tono: "danger" | "warning" } | null>(null);
  const [contexto, setContexto] = useState<ContextoInvitacion | null>(null);
  const [yaEnviado, setYaEnviado] = useState(false);

  const [paso, setPaso] = useState(0);
  const [empresa, setEmpresa] = useState<EmpresaForm>(EMPRESA_VACIA);
  const [perfil, setPerfil] = useState<PerfilForm>(PERFIL_VACIO);
  const [necesidades, setNecesidades] = useState<NecesidadesEmpresa>({});
  const [capacidad, setCapacidad] = useState<CapacidadForm>(CAPACIDAD_VACIA);
  const [maestros, setMaestros] = useState<MaestroForm[]>([{ ...MAESTRO_VACIO }]);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  useEffect(() => {
    if (!token) return;
    async function cargar() {
      setCargando(true);
      try {
        const res = await fetch(`/api/invitaciones/${token}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorCarga({ mensaje: data.error ?? "No fue posible cargar la invitación.", tono: res.status === 410 ? "warning" : "danger" });
          return;
        }
        if (data.estado === "enviado" || data.estado === "en_revision" || data.estado === "procesado") {
          setYaEnviado(true);
        }
        setContexto(data);
      } catch {
        setErrorCarga({ mensaje: "No fue posible conectar con el servidor. Verifica tu conexión e intenta nuevamente.", tono: "danger" });
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [token]);

  function setEmpresaCampo<K extends keyof EmpresaForm>(campo: K, valor: EmpresaForm[K]) {
    setEmpresa((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [`empresa.${campo}`]: "" }));
  }
  function setPerfilCampo<K extends keyof PerfilForm>(campo: K, valor: PerfilForm[K]) {
    setPerfil((f) => ({ ...f, [campo]: valor }));
  }
  function setCapacidadCampo<K extends keyof CapacidadForm>(campo: K, valor: CapacidadForm[K]) {
    setCapacidad((f) => ({ ...f, [campo]: valor }));
  }
  function setMaestroCampo(idx: number, campo: keyof MaestroForm, valor: string) {
    setMaestros((lista) => lista.map((m, i) => (i === idx ? { ...m, [campo]: valor } : m)));
    setErrores((e) => ({ ...e, [`maestro.${idx}.${campo}`]: "" }));
  }
  function agregarMaestro() {
    setMaestros((lista) => [...lista, { ...MAESTRO_VACIO }]);
  }
  function quitarMaestro(idx: number) {
    setMaestros((lista) => (lista.length > 1 ? lista.filter((_, i) => i !== idx) : lista));
  }

  function validarPaso(p: number): boolean {
    const nuevos: Record<string, string> = {};
    if (p === 0) {
      if (!empresa.razonSocial.trim()) nuevos["empresa.razonSocial"] = "Campo obligatorio.";
      if (empresa.rut.trim() && !validarRut(empresa.rut)) nuevos["empresa.rut"] = "RUT inválido.";
      if (empresa.email.trim() && !validarEmail(empresa.email)) nuevos["empresa.email"] = "Correo inválido.";
      if (empresa.contactoEmail.trim() && !validarEmail(empresa.contactoEmail)) nuevos["empresa.contactoEmail"] = "Correo inválido.";
      if (empresa.telefono.trim() && !validarTelefonoChileno(empresa.telefono)) nuevos["empresa.telefono"] = "Teléfono inválido.";
      if (empresa.contactoTelefono.trim() && !validarTelefonoChileno(empresa.contactoTelefono)) nuevos["empresa.contactoTelefono"] = "Teléfono inválido.";
    }
    if (p === 4) {
      maestros.forEach((m, i) => {
        if (!m.nombreCompleto.trim()) nuevos[`maestro.${i}.nombreCompleto`] = "Campo obligatorio.";
        if (m.email?.trim() && !validarEmail(m.email)) nuevos[`maestro.${i}.email`] = "Correo inválido.";
      });
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  function siguiente() {
    if (!validarPaso(paso)) return;
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function anterior() {
    setPaso((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function enviarFormulario() {
    if (!validarPaso(0) || !validarPaso(4) || enviando) return;
    setEnviando(true);
    setErrorEnvio("");
    try {
      const payload = {
        empresa: { ...empresa, rut: empresa.rut.trim() ? empresa.rut : undefined },
        perfil,
        necesidades,
        capacidad: {
          cantidadEstudiantes: capacidad.cantidadEstudiantes.trim() ? Number(capacidad.cantidadEstudiantes) : undefined,
          especialidades: capacidad.especialidades.trim() ? capacidad.especialidades.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          cursos: capacidad.cursos.trim() ? capacidad.cursos.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          periodo: capacidad.periodo || undefined,
          jornada: capacidad.jornada || undefined,
          horarios: capacidad.horarios || undefined,
          restricciones: capacidad.restricciones || undefined,
        },
        maestrosGuia: maestros.filter((m) => m.nombreCompleto.trim()),
      };
      const res = await fetch(`/api/invitaciones/${token}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorEnvio(data.error ?? "No fue posible enviar el formulario.");
        return;
      }
      setEnviado(true);
    } catch {
      setErrorEnvio("No fue posible conectar con el servidor. Verifica tu conexión e intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return <Pantalla icon={<Clock size={26} />} titulo="Cargando invitación..." descripcion="Un momento, por favor." />;
  }

  if (errorCarga) {
    return (
      <Pantalla
        icon={errorCarga.tono === "warning" ? <Clock size={26} /> : <ShieldOff size={26} />}
        titulo={errorCarga.tono === "warning" ? "Enlace no disponible" : "Enlace no válido"}
        descripcion={errorCarga.mensaje}
        tono={errorCarga.tono}
      />
    );
  }

  if (yaEnviado || enviado) {
    return (
      <Pantalla
        icon={<CheckCircle2 size={26} />}
        titulo="Formulario enviado"
        descripcion="Gracias por completar la información. El liceo revisará los datos y se pondrá en contacto contigo."
      />
    );
  }

  if (!contexto) return null;

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen">
      <header style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }} className="px-4 py-4 sm:px-8">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Image src="/logo-icon.png" alt="Logo SIGEDUAL" width={36} height={36} className="w-9 h-9 object-contain flex-shrink-0" />
          <div>
            <p style={{ color: "var(--text-primary)" }} className="text-sm font-bold">{contexto.liceoNombre}</p>
            <p style={{ color: "var(--text-muted)" }} className="text-xs">Formulario de levantamiento — Empresa Dual</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
          {contexto.profesorNombre} te invita a registrar la información de tu empresa para evaluar una posible colaboración dual con {contexto.liceoNombre}.
        </p>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-1.5 mb-6 flex-wrap">
          {PASOS.map((p, i) => (
            <div key={p} className="flex items-center gap-1.5">
              <div
                style={{
                  background: i <= paso ? "var(--accent)" : "var(--bg-surface)",
                  color: i <= paso ? "var(--text-on-accent)" : "var(--text-muted)",
                  border: i <= paso ? "none" : "1px solid var(--border-light)",
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
              >
                {i + 1}
              </div>
              <span style={{ color: i === paso ? "var(--text-primary)" : "var(--text-muted)" }} className="text-xs hidden sm:inline">{p}</span>
              {i < PASOS.length - 1 && <div style={{ background: "var(--border-light)" }} className="w-4 h-px" />}
            </div>
          ))}
        </div>

        {errorEnvio && (
          <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
            <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorEnvio}</p>
          </div>
        )}

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-6">
          {paso === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Datos de la empresa</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Razón social *" error={errores["empresa.razonSocial"]} span>
                  <input value={empresa.razonSocial} onChange={(e) => setEmpresaCampo("razonSocial", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Nombre de fantasía (opcional)">
                  <input value={empresa.nombreFantasia} onChange={(e) => setEmpresaCampo("nombreFantasia", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="RUT (opcional)" error={errores["empresa.rut"]}>
                  <input value={empresa.rut} onChange={(e) => setEmpresaCampo("rut", formatearRut(e.target.value))} placeholder="76.123.456-7" style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Giro (opcional)" span>
                  <input value={empresa.giro} onChange={(e) => setEmpresaCampo("giro", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Dirección (opcional)" span>
                  <input value={empresa.direccion} onChange={(e) => setEmpresaCampo("direccion", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Comuna (opcional)">
                  <input value={empresa.comuna} onChange={(e) => setEmpresaCampo("comuna", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Región (opcional)">
                  <Select value={empresa.region} onChange={(v) => setEmpresaCampo("region", v)} ariaLabel="Región" placeholder="Selecciona una región" opciones={REGIONES.map((r) => ({ value: r, label: r }))} />
                </Campo>
                <Campo label="Teléfono (opcional)" error={errores["empresa.telefono"]}>
                  <input value={empresa.telefono} onChange={(e) => setEmpresaCampo("telefono", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Correo (opcional)" error={errores["empresa.email"]}>
                  <input value={empresa.email} onChange={(e) => setEmpresaCampo("email", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Sitio web (opcional)" span>
                  <input value={empresa.sitioWeb} onChange={(e) => setEmpresaCampo("sitioWeb", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Nombre de contacto (opcional)">
                  <input value={empresa.contactoNombre} onChange={(e) => setEmpresaCampo("contactoNombre", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Cargo del contacto (opcional)">
                  <input value={empresa.contactoCargo} onChange={(e) => setEmpresaCampo("contactoCargo", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Correo del contacto (opcional)" error={errores["empresa.contactoEmail"]}>
                  <input value={empresa.contactoEmail} onChange={(e) => setEmpresaCampo("contactoEmail", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Teléfono del contacto (opcional)" error={errores["empresa.contactoTelefono"]}>
                  <input value={empresa.contactoTelefono} onChange={(e) => setEmpresaCampo("contactoTelefono", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User2 size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Perfil de la empresa</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Actividad principal (opcional)" span>
                  <textarea value={perfil.actividadPrincipal} onChange={(e) => setPerfilCampo("actividadPrincipal", e.target.value)} rows={2} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Área de trabajo (opcional)">
                  <input value={perfil.areaTrabajo} onChange={(e) => setPerfilCampo("areaTrabajo", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Tipo de tareas (opcional)">
                  <input value={perfil.tipoTareas} onChange={(e) => setPerfilCampo("tipoTareas", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Tecnologías utilizadas (opcional)">
                  <input value={perfil.tecnologias} onChange={(e) => setPerfilCampo("tecnologias", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Herramientas utilizadas (opcional)">
                  <input value={perfil.herramientas} onChange={(e) => setPerfilCampo("herramientas", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Ambiente laboral (opcional)" span>
                  <input value={perfil.ambienteLaboral} onChange={(e) => setPerfilCampo("ambienteLaboral", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Características importantes en un estudiante (opcional)" span>
                  <textarea value={perfil.caracteristicasImportantes} onChange={(e) => setPerfilCampo("caracteristicasImportantes", e.target.value)} rows={2} style={inputStyle} className={inputClass} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Necesidades y criterios</h2>
              </div>
              <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Todos estos campos son opcionales — ayudan al liceo a entender mejor tu empresa, pero no es obligatorio responderlos.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Nivel de actividad del puesto">
                  <Select value={necesidades.nivelActividad ?? ""} onChange={(v) => setNecesidades((n) => ({ ...n, nivelActividad: v as NecesidadesEmpresa["nivelActividad"] }))} ariaLabel="Nivel de actividad" placeholder="Sin especificar" opciones={OPCIONES_NIVEL_ACTIVIDAD} />
                </Campo>
                <Campo label="Ritmo de aprendizaje esperado">
                  <Select value={necesidades.ritmoAprendizaje ?? ""} onChange={(v) => setNecesidades((n) => ({ ...n, ritmoAprendizaje: v as NecesidadesEmpresa["ritmoAprendizaje"] }))} ariaLabel="Ritmo de aprendizaje" placeholder="Sin especificar" opciones={OPCIONES_RITMO} />
                </Campo>
                <Campo label="Autonomía requerida">
                  <Select value={necesidades.autonomia ?? ""} onChange={(v) => setNecesidades((n) => ({ ...n, autonomia: v as NecesidadesEmpresa["autonomia"] }))} ariaLabel="Autonomía" placeholder="Sin especificar" opciones={OPCIONES_AUTONOMIA} />
                </Campo>
                <Campo label="Capacidad de adaptación">
                  <Select value={necesidades.adaptacion ?? ""} onChange={(v) => setNecesidades((n) => ({ ...n, adaptacion: v as NecesidadesEmpresa["adaptacion"] }))} ariaLabel="Adaptación" placeholder="Sin especificar" opciones={OPCIONES_ADAPTACION} />
                </Campo>
                <Campo label="Nivel de comunicación requerido">
                  <Select value={necesidades.comunicacion ?? ""} onChange={(v) => setNecesidades((n) => ({ ...n, comunicacion: v as NecesidadesEmpresa["comunicacion"] }))} ariaLabel="Comunicación" placeholder="Sin especificar" opciones={OPCIONES_COMUNICACION} />
                </Campo>
                <Campo label="Trabajo en equipo">
                  <Select value={necesidades.trabajoEquipo ?? ""} onChange={(v) => setNecesidades((n) => ({ ...n, trabajoEquipo: v as NecesidadesEmpresa["trabajoEquipo"] }))} ariaLabel="Trabajo en equipo" placeholder="Sin especificar" opciones={OPCIONES_TRABAJO_EQUIPO} />
                </Campo>
                <Campo label="Otras necesidades u observaciones (opcional)" span>
                  <textarea value={necesidades.otras ?? ""} onChange={(e) => setNecesidades((n) => ({ ...n, otras: e.target.value }))} rows={2} style={inputStyle} className={inputClass} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Capacidad de recepción</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Cantidad de estudiantes que puede recibir (opcional)">
                  <input type="number" min={0} value={capacidad.cantidadEstudiantes} onChange={(e) => setCapacidadCampo("cantidadEstudiantes", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Período disponible (opcional)">
                  <input value={capacidad.periodo} onChange={(e) => setCapacidadCampo("periodo", e.target.value)} placeholder="Ej: segundo semestre" style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Especialidades de interés (opcional)" span>
                  <input value={capacidad.especialidades} onChange={(e) => setCapacidadCampo("especialidades", e.target.value)} placeholder="Separadas por coma" style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Cursos de interés (opcional)" span>
                  <input value={capacidad.cursos} onChange={(e) => setCapacidadCampo("cursos", e.target.value)} placeholder="Separados por coma" style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Jornada (opcional)">
                  <input value={capacidad.jornada} onChange={(e) => setCapacidadCampo("jornada", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Horarios (opcional)">
                  <input value={capacidad.horarios} onChange={(e) => setCapacidadCampo("horarios", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Restricciones (opcional)" span>
                  <textarea value={capacidad.restricciones} onChange={(e) => setCapacidadCampo("restricciones", e.target.value)} rows={2} style={inputStyle} className={inputClass} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 4 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users2 size={18} style={{ color: "var(--accent-light)" }} />
                  <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Maestros Guía</h2>
                </div>
                <button onClick={agregarMaestro} type="button" style={{ color: "var(--accent-light)" }} className="text-xs font-semibold flex items-center gap-1">
                  <Plus size={14} /> Agregar otro
                </button>
              </div>
              <div className="flex flex-col gap-5">
                {maestros.map((m, i) => (
                  <div key={i} style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p style={{ color: "var(--text-primary)" }} className="text-xs font-semibold">Maestro guía {i + 1}</p>
                      {maestros.length > 1 && (
                        <button onClick={() => quitarMaestro(i)} type="button" style={{ color: "var(--danger)" }} className="text-xs flex items-center gap-1">
                          <Trash2 size={13} /> Quitar
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Campo label="Nombre completo *" error={errores[`maestro.${i}.nombreCompleto`]} span>
                        <input value={m.nombreCompleto} onChange={(e) => setMaestroCampo(i, "nombreCompleto", e.target.value)} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="RUN (opcional)">
                        <input value={m.run ?? ""} onChange={(e) => setMaestroCampo(i, "run", formatearRut(e.target.value))} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="Cargo (opcional)">
                        <input value={m.cargo ?? ""} onChange={(e) => setMaestroCampo(i, "cargo", e.target.value)} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="Área (opcional)">
                        <input value={m.area ?? ""} onChange={(e) => setMaestroCampo(i, "area", e.target.value)} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="Especialidad (opcional)">
                        <input value={m.especialidad ?? ""} onChange={(e) => setMaestroCampo(i, "especialidad", e.target.value)} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="Correo (opcional)" error={errores[`maestro.${i}.email`]}>
                        <input value={m.email ?? ""} onChange={(e) => setMaestroCampo(i, "email", e.target.value)} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="Teléfono (opcional)">
                        <input value={m.telefono ?? ""} onChange={(e) => setMaestroCampo(i, "telefono", e.target.value)} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="Experiencia (opcional)">
                        <input value={m.experiencia ?? ""} onChange={(e) => setMaestroCampo(i, "experiencia", e.target.value)} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="Disponibilidad (opcional)">
                        <input value={m.disponibilidad ?? ""} onChange={(e) => setMaestroCampo(i, "disponibilidad", e.target.value)} style={inputStyle} className={inputClass} />
                      </Campo>
                      <Campo label="Observaciones (opcional)" span>
                        <textarea value={m.observaciones ?? ""} onChange={(e) => setMaestroCampo(i, "observaciones", e.target.value)} rows={2} style={inputStyle} className={inputClass} />
                      </Campo>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paso === 5 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Revisión final</h2>
              </div>
              <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
                Revisa que la información sea correcta antes de enviar. Una vez enviado el formulario, no podrás modificarlo desde este enlace.
              </p>
              <div className="flex flex-col gap-3 text-sm">
                <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3">
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase mb-1">Empresa</p>
                  <p style={{ color: "var(--text-primary)" }}>{empresa.razonSocial}{empresa.rut ? ` · ${empresa.rut}` : ""}</p>
                </div>
                <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3">
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase mb-1">Maestros Guía</p>
                  {maestros.filter((m) => m.nombreCompleto.trim()).map((m, i) => (
                    <p key={i} style={{ color: "var(--text-primary)" }}>{m.nombreCompleto}{m.cargo ? ` · ${m.cargo}` : ""}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-7 pt-5" style={{ borderTop: "1px solid var(--border-light)" }}>
            {paso > 0 && (
              <button
                onClick={anterior}
                type="button"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={15} /> Atrás
              </button>
            )}
            {paso < PASOS.length - 1 ? (
              <button
                onClick={siguiente}
                type="button"
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                Siguiente <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={enviarFormulario}
                disabled={enviando}
                type="button"
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {enviando ? "Enviando..." : "Enviar formulario"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
