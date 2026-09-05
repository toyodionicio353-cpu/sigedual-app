"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  BadgeCheck, Phone, GraduationCap, HeartPulse, Users, Sparkles, CheckCircle2,
  ArrowLeft, ArrowRight, Plus, Trash2, AlertTriangle, Clock, ShieldOff,
} from "lucide-react";
import { formatearRut, validarRut, validarEmail, validarTelefonoChileno } from "@/lib/rut";
import { RASGOS_ESTUDIANTE, HABILIDADES } from "@/lib/caracteristicas";
import Select from "@/components/ui/Select";

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors disabled:opacity-50";

const NIVELES = ["1° Medio", "2° Medio", "3° Medio", "4° Medio"];
const LETRAS_CURSO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const JORNADAS = ["Diurna", "Vespertina", "Jornada Completa", "Otro"];
const PARENTESCOS = ["Padre", "Madre", "Tutor legal", "Otro"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_ACADEMICOS = Array.from({ length: 5 }, (_, i) => ANIO_ACTUAL + i);

interface ContextoInvitacion {
  estado: string;
  liceoNombre: string;
  profesorNombre: string;
  nombrePreliminar?: string;
  especialidades: { id: string; nombre: string }[];
}

interface IdentificacionForm {
  run: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string;
  fechaNacimiento: string; sexo: string; nacionalidad: string;
}
interface ContactoForm {
  email: string; telefono: string; direccion: string; comuna: string; ciudad: string;
}
interface AcademicaForm {
  anioAcademico: string; nivel: string; curso: string; especialidadId: string; jornada: string;
}
interface MedicaForm {
  enfermedadesCronicas: string; alergias: string;
}
interface ApoderadoForm {
  apoderadoNombre: string; apoderadoRun: string; apoderadoParentesco: string;
  apoderadoTelefono: string; apoderadoEmail: string; apoderadoDomicilio: string; apoderadoCiudad: string;
}

const IDENTIFICACION_VACIA: IdentificacionForm = { run: "", nombres: "", apellidoPaterno: "", apellidoMaterno: "", fechaNacimiento: "", sexo: "", nacionalidad: "" };
const CONTACTO_VACIO: ContactoForm = { email: "", telefono: "", direccion: "", comuna: "", ciudad: "" };
const ACADEMICA_VACIA: AcademicaForm = { anioAcademico: String(ANIO_ACTUAL), nivel: "", curso: "", especialidadId: "", jornada: "" };
const MEDICA_VACIA: MedicaForm = { enfermedadesCronicas: "", alergias: "" };
const APODERADO_VACIO: ApoderadoForm = {
  apoderadoNombre: "", apoderadoRun: "", apoderadoParentesco: "",
  apoderadoTelefono: "", apoderadoEmail: "", apoderadoDomicilio: "", apoderadoCiudad: "",
};

const PASOS = ["Identificación", "Contacto", "Información académica", "Información médica", "Apoderado", "Características y observaciones", "Revisión"];

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

function Pills({ opciones, seleccionadas, onToggle }: { opciones: string[]; seleccionadas: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="sm:col-span-2 flex flex-wrap gap-2">
      {opciones.map((o) => {
        const activo = seleccionadas.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            style={{
              background: activo ? "var(--accent)" : "var(--bg-surface)",
              border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`,
              color: activo ? "var(--text-on-accent)" : "var(--text-secondary)",
            }}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function FormularioInvitacionEstudiantePage() {
  const { token } = useParams<{ token: string }>();

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<{ mensaje: string; tono: "danger" | "warning" } | null>(null);
  const [contexto, setContexto] = useState<ContextoInvitacion | null>(null);
  const [yaEnviado, setYaEnviado] = useState(false);

  const [paso, setPaso] = useState(0);
  const [identificacion, setIdentificacion] = useState<IdentificacionForm>(IDENTIFICACION_VACIA);
  const [contacto, setContacto] = useState<ContactoForm>(CONTACTO_VACIO);
  const [academica, setAcademica] = useState<AcademicaForm>(ACADEMICA_VACIA);
  const [medica, setMedica] = useState<MedicaForm>(MEDICA_VACIA);
  const [otrosMedicos, setOtrosMedicos] = useState<string[]>([]);
  const [apoderado, setApoderado] = useState<ApoderadoForm>(APODERADO_VACIO);
  const [rasgosSel, setRasgosSel] = useState<string[]>([]);
  const [habilidadesSel, setHabilidadesSel] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  useEffect(() => {
    if (!token) return;
    async function cargar() {
      setCargando(true);
      try {
        const res = await fetch(`/api/invitaciones-estudiante/${token}`);
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

  function setIdCampo<K extends keyof IdentificacionForm>(campo: K, valor: IdentificacionForm[K]) {
    setIdentificacion((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [`identificacion.${campo}`]: "" }));
  }
  function setContactoCampo<K extends keyof ContactoForm>(campo: K, valor: ContactoForm[K]) {
    setContacto((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [`contacto.${campo}`]: "" }));
  }
  function setAcademicaCampo<K extends keyof AcademicaForm>(campo: K, valor: AcademicaForm[K]) {
    setAcademica((f) => ({ ...f, [campo]: valor, ...(campo === "nivel" ? { curso: "" } : {}) }));
    setErrores((e) => ({ ...e, [`academica.${campo}`]: "" }));
  }
  function setApoderadoCampo<K extends keyof ApoderadoForm>(campo: K, valor: ApoderadoForm[K]) {
    setApoderado((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [`apoderado.${campo}`]: "" }));
  }
  function toggleRasgo(v: string) {
    setRasgosSel((sel) => (sel.includes(v) ? sel.filter((s) => s !== v) : [...sel, v]));
  }
  function toggleHabilidad(v: string) {
    setHabilidadesSel((sel) => (sel.includes(v) ? sel.filter((s) => s !== v) : [...sel, v]));
  }
  function agregarOtroMedico() {
    setOtrosMedicos((lista) => [...lista, ""]);
  }
  function cambiarOtroMedico(idx: number, valor: string) {
    setOtrosMedicos((lista) => lista.map((v, i) => (i === idx ? valor : v)));
  }
  function quitarOtroMedico(idx: number) {
    setOtrosMedicos((lista) => lista.filter((_, i) => i !== idx));
  }

  const cursosDisponibles = academica.nivel ? LETRAS_CURSO.map((letra) => `${academica.nivel} ${letra}`) : [];

  function validarPaso(p: number): boolean {
    const nuevos: Record<string, string> = {};
    if (p === 0) {
      if (!identificacion.run.trim() || !validarRut(identificacion.run)) nuevos["identificacion.run"] = "RUN inválido.";
      if (!identificacion.nombres.trim()) nuevos["identificacion.nombres"] = "Campo obligatorio.";
      if (!identificacion.apellidoPaterno.trim()) nuevos["identificacion.apellidoPaterno"] = "Campo obligatorio.";
    }
    if (p === 1) {
      if (contacto.email.trim() && !validarEmail(contacto.email)) nuevos["contacto.email"] = "Correo inválido.";
      if (contacto.telefono.trim() && !validarTelefonoChileno(contacto.telefono)) nuevos["contacto.telefono"] = "Teléfono inválido.";
    }
    if (p === 2) {
      if (!academica.nivel) nuevos["academica.nivel"] = "Campo obligatorio.";
      if (!academica.curso) nuevos["academica.curso"] = "Campo obligatorio.";
      if (!academica.especialidadId) nuevos["academica.especialidadId"] = "Campo obligatorio.";
    }
    if (p === 4) {
      if (apoderado.apoderadoRun.trim() && !validarRut(apoderado.apoderadoRun)) nuevos["apoderado.apoderadoRun"] = "RUN inválido.";
      if (apoderado.apoderadoEmail.trim() && !validarEmail(apoderado.apoderadoEmail)) nuevos["apoderado.apoderadoEmail"] = "Correo inválido.";
      if (apoderado.apoderadoTelefono.trim() && !validarTelefonoChileno(apoderado.apoderadoTelefono)) nuevos["apoderado.apoderadoTelefono"] = "Teléfono inválido.";
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
    if (!validarPaso(0) || !validarPaso(1) || !validarPaso(2) || !validarPaso(4) || enviando) return;
    setEnviando(true);
    setErrorEnvio("");
    try {
      const payload = {
        ...identificacion,
        run: formatearRut(identificacion.run),
        ...contacto,
        ...academica,
        ...medica,
        informacionMedicaAdicional: otrosMedicos.map((v) => v.trim()).filter(Boolean),
        rasgos: rasgosSel,
        habilidades: habilidadesSel,
        ...apoderado,
        apoderadoRun: apoderado.apoderadoRun.trim() ? formatearRut(apoderado.apoderadoRun) : "",
        observaciones,
      };
      const res = await fetch(`/api/invitaciones-estudiante/${token}/enviar`, {
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
            <p style={{ color: "var(--text-muted)" }} className="text-xs">Ficha de estudiante</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
          {contexto.profesorNombre} te invita a completar tu información para registrarte en {contexto.liceoNombre}.
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
                <BadgeCheck size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Identificación</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="RUN *" error={errores["identificacion.run"]}>
                  <input value={identificacion.run} onChange={(e) => setIdCampo("run", formatearRut(e.target.value))} placeholder="12.345.678-9" style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Nombres *" error={errores["identificacion.nombres"]}>
                  <input value={identificacion.nombres} onChange={(e) => setIdCampo("nombres", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Apellido paterno *" error={errores["identificacion.apellidoPaterno"]}>
                  <input value={identificacion.apellidoPaterno} onChange={(e) => setIdCampo("apellidoPaterno", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Apellido materno (opcional)">
                  <input value={identificacion.apellidoMaterno} onChange={(e) => setIdCampo("apellidoMaterno", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Fecha de nacimiento (opcional)">
                  <input type="date" value={identificacion.fechaNacimiento} onChange={(e) => setIdCampo("fechaNacimiento", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Sexo (opcional)">
                  <Select value={identificacion.sexo} onChange={(v) => setIdCampo("sexo", v)} ariaLabel="Sexo" placeholder="Selecciona" opciones={[{ value: "Femenino", label: "Femenino" }, { value: "Masculino", label: "Masculino" }, { value: "Otro", label: "Otro" }]} />
                </Campo>
                <Campo label="Nacionalidad (opcional)">
                  <input value={identificacion.nacionalidad} onChange={(e) => setIdCampo("nacionalidad", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Phone size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Contacto</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Correo (opcional)" error={errores["contacto.email"]}>
                  <input value={contacto.email} onChange={(e) => setContactoCampo("email", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Teléfono (opcional)" error={errores["contacto.telefono"]}>
                  <input value={contacto.telefono} onChange={(e) => setContactoCampo("telefono", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Dirección (opcional)" span>
                  <input value={contacto.direccion} onChange={(e) => setContactoCampo("direccion", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Comuna (opcional)">
                  <input value={contacto.comuna} onChange={(e) => setContactoCampo("comuna", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Ciudad (opcional)">
                  <input value={contacto.ciudad} onChange={(e) => setContactoCampo("ciudad", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Información académica</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Año académico">
                  <Select value={academica.anioAcademico} onChange={(v) => setAcademicaCampo("anioAcademico", v)} ariaLabel="Año académico" opciones={ANIOS_ACADEMICOS.map((a) => ({ value: String(a), label: String(a) }))} />
                </Campo>
                <Campo label="Nivel *" error={errores["academica.nivel"]}>
                  <Select value={academica.nivel} onChange={(v) => setAcademicaCampo("nivel", v)} ariaLabel="Nivel" placeholder="Selecciona un nivel" opciones={NIVELES.map((n) => ({ value: n, label: n }))} />
                </Campo>
                <Campo label="Curso *" error={errores["academica.curso"]}>
                  <Select value={academica.curso} onChange={(v) => setAcademicaCampo("curso", v)} disabled={!academica.nivel} ariaLabel="Curso" placeholder={academica.nivel ? "Selecciona un curso" : "Primero selecciona un nivel"} opciones={cursosDisponibles.map((c) => ({ value: c, label: c }))} />
                </Campo>
                <Campo label="Especialidad *" error={errores["academica.especialidadId"]}>
                  <Select value={academica.especialidadId} onChange={(v) => setAcademicaCampo("especialidadId", v)} ariaLabel="Especialidad" placeholder="Selecciona una especialidad" opciones={contexto.especialidades.map((e) => ({ value: e.id, label: e.nombre }))} />
                </Campo>
                <Campo label="Jornada (opcional)">
                  <Select value={academica.jornada} onChange={(v) => setAcademicaCampo("jornada", v)} ariaLabel="Jornada" placeholder="Selecciona una jornada" opciones={JORNADAS.map((j) => ({ value: j, label: j }))} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <HeartPulse size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Información médica</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Enfermedades crónicas (opcional)" span>
                  <textarea value={medica.enfermedadesCronicas} onChange={(e) => setMedica((f) => ({ ...f, enfermedadesCronicas: e.target.value }))} rows={2} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Alergias (opcional)" span>
                  <textarea value={medica.alergias} onChange={(e) => setMedica((f) => ({ ...f, alergias: e.target.value }))} rows={2} style={inputStyle} className={inputClass} />
                </Campo>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium">Otros antecedentes médicos (opcional)</p>
                  <button onClick={agregarOtroMedico} type="button" style={{ color: "var(--accent-light)" }} className="text-xs font-semibold flex items-center gap-1">
                    <Plus size={14} /> Agregar
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {otrosMedicos.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={v} onChange={(e) => cambiarOtroMedico(i, e.target.value)} style={inputStyle} className={`${inputClass} flex-1`} />
                      <button onClick={() => quitarOtroMedico(i)} type="button" style={{ color: "var(--danger)" }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {paso === 4 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Apoderado</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Nombre del apoderado (opcional)">
                  <input value={apoderado.apoderadoNombre} onChange={(e) => setApoderadoCampo("apoderadoNombre", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="RUN del apoderado (opcional)" error={errores["apoderado.apoderadoRun"]}>
                  <input value={apoderado.apoderadoRun} onChange={(e) => setApoderadoCampo("apoderadoRun", formatearRut(e.target.value))} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Parentesco (opcional)">
                  <Select value={apoderado.apoderadoParentesco} onChange={(v) => setApoderadoCampo("apoderadoParentesco", v)} ariaLabel="Parentesco" placeholder="Selecciona" opciones={PARENTESCOS.map((p) => ({ value: p, label: p }))} />
                </Campo>
                <Campo label="Teléfono del apoderado (opcional)" error={errores["apoderado.apoderadoTelefono"]}>
                  <input value={apoderado.apoderadoTelefono} onChange={(e) => setApoderadoCampo("apoderadoTelefono", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Correo del apoderado (opcional)" error={errores["apoderado.apoderadoEmail"]}>
                  <input value={apoderado.apoderadoEmail} onChange={(e) => setApoderadoCampo("apoderadoEmail", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Domicilio del apoderado (opcional)">
                  <input value={apoderado.apoderadoDomicilio} onChange={(e) => setApoderadoCampo("apoderadoDomicilio", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
                <Campo label="Ciudad del apoderado (opcional)">
                  <input value={apoderado.apoderadoCiudad} onChange={(e) => setApoderadoCampo("apoderadoCiudad", e.target.value)} style={inputStyle} className={inputClass} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 5 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} style={{ color: "var(--accent-light)" }} />
                <h2 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Características y observaciones</h2>
              </div>
              <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Todos estos campos son opcionales.</p>

              <div className="mt-2">
                <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-3">Rasgos personales</p>
                <Pills opciones={RASGOS_ESTUDIANTE} seleccionadas={rasgosSel} onToggle={toggleRasgo} />
              </div>

              <div className="mt-6">
                <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-3">Habilidades</p>
                <Pills opciones={HABILIDADES} seleccionadas={habilidadesSel} onToggle={toggleHabilidad} />
              </div>

              <div className="mt-6">
                <Campo label="Observaciones (opcional)" span>
                  <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} style={inputStyle} className={inputClass} />
                </Campo>
              </div>
            </div>
          )}

          {paso === 6 && (
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
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase mb-1">Estudiante</p>
                  <p style={{ color: "var(--text-primary)" }}>
                    {[identificacion.nombres, identificacion.apellidoPaterno, identificacion.apellidoMaterno].filter(Boolean).join(" ")}
                    {identificacion.run ? ` · ${identificacion.run}` : ""}
                  </p>
                </div>
                <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3">
                  <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase mb-1">Curso y especialidad</p>
                  <p style={{ color: "var(--text-primary)" }}>
                    {academica.curso || "—"} · {contexto.especialidades.find((e) => e.id === academica.especialidadId)?.nombre || "—"}
                  </p>
                </div>
                {apoderado.apoderadoNombre && (
                  <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-3">
                    <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase mb-1">Apoderado</p>
                    <p style={{ color: "var(--text-primary)" }}>{apoderado.apoderadoNombre}{apoderado.apoderadoParentesco ? ` · ${apoderado.apoderadoParentesco}` : ""}</p>
                  </div>
                )}
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
