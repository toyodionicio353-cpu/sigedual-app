"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatearRut, normalizarRut, validarRut, validarEmail, validarTelefonoChileno } from "@/lib/rut";
import type { Estudiante, Especialidad } from "@/types";
import {
  Users, ArrowLeft, UserPlus, CalendarClock, BadgeCheck,
  Phone, GraduationCap, HeartPulse, Sparkles, FileText,
  CheckCircle2, Eye, Plus, X,
} from "lucide-react";

const NIVELES = ["1° Medio", "2° Medio", "3° Medio", "4° Medio"];
const LETRAS_CURSO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const JORNADAS = ["Diurna", "Vespertina"];
const ESTADOS: Estudiante["estado"][] = ["activo", "inactivo", "egresado", "retirado"];
const PARENTESCOS = ["Padre", "Madre", "Tutor legal", "Otro"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_ACADEMICOS = Array.from({ length: 5 }, (_, i) => ANIO_ACTUAL + i);

const RASGOS = [
  "Tranquilo/a", "Nervioso/a", "Tímido/a", "Extrovertido/a", "Ansioso/a",
  "Seguro/a de sí mismo/a", "Sensible", "Resiliente", "Paciente", "Impulsivo/a",
  "Buena comunicación", "Trabajo en equipo", "Liderazgo", "Responsable", "Puntual",
  "Proactivo/a", "Autónomo/a", "Necesita supervisión constante",
  "Buena tolerancia a la presión", "Baja tolerancia a la presión",
  "Adaptable a cambios", "Dificultad para adaptarse a cambios",
  "Orientado/a al detalle", "Creativo/a",
];

interface FormState {
  run: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  sexo: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  anioAcademico: string;
  nivel: string;
  curso: string;
  especialidadId: string;
  jornada: string;
  estado: Estudiante["estado"];
  enfermedadesCronicas: string;
  alergias: string;
  apoderadoNombre: string;
  apoderadoRun: string;
  apoderadoParentesco: string;
  apoderadoTelefono: string;
  apoderadoEmail: string;
  observaciones: string;
}

const EMPTY: FormState = {
  run: "", nombres: "", apellidoPaterno: "", apellidoMaterno: "",
  fechaNacimiento: "", sexo: "",
  email: "", telefono: "", direccion: "", comuna: "", ciudad: "",
  anioAcademico: String(ANIO_ACTUAL), nivel: "", curso: "",
  especialidadId: "", jornada: "", estado: "activo",
  enfermedadesCronicas: "", alergias: "",
  apoderadoNombre: "", apoderadoRun: "", apoderadoParentesco: "",
  apoderadoTelefono: "", apoderadoEmail: "",
  observaciones: "",
};

function Seccion({
  icon, titulo, subtitulo, children,
}: { icon: React.ReactNode; titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: "var(--accent-blue-light)" }}>{icon}</span>
        <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{titulo}</h3>
      </div>
      {subtitulo && (
        <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">{subtitulo}</p>
      )}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${subtitulo ? "" : "mt-4"}`}>{children}</div>
    </div>
  );
}

function Campo({
  label, error, children, span,
}: { label: string; error?: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">{label}</label>
      {children}
      {error && (
        <p style={{ color: "var(--danger)" }} className="text-xs mt-1">{error}</p>
      )}
    </div>
  );
}

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors disabled:opacity-50";

export default function AgregarEstudiantePage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});
  const [otrosMedicos, setOtrosMedicos] = useState<string[]>([]);
  const [rasgos, setRasgos] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
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
    return {
      total: estudiantes.length,
      agregadosEsteAnio,
      activos,
      ultimoTexto,
    };
  }, [estudiantes]);

  const cursosDisponibles = form.nivel ? LETRAS_CURSO.map((letra) => `${form.nivel} ${letra}`) : [];

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errores[key]) setErrores((e) => ({ ...e, [key]: undefined }));
  }

  function cambiarNivel(nivel: string) {
    setForm((f) => ({ ...f, nivel, curso: "" }));
    if (errores.nivel) setErrores((e) => ({ ...e, nivel: undefined }));
  }

  function toggleRasgo(rasgo: string) {
    setRasgos((prev) => (prev.includes(rasgo) ? prev.filter((r) => r !== rasgo) : [...prev, rasgo]));
  }

  function agregarOtroMedico() {
    setOtrosMedicos((prev) => [...prev, ""]);
  }

  function actualizarOtroMedico(index: number, valor: string) {
    setOtrosMedicos((prev) => prev.map((v, i) => (i === index ? valor : v)));
  }

  function quitarOtroMedico(index: number) {
    setOtrosMedicos((prev) => prev.filter((_, i) => i !== index));
  }

  function validar(): boolean {
    const nuevosErrores: Partial<Record<keyof FormState, string>> = {};

    if (!form.run.trim()) nuevosErrores.run = "El RUN es obligatorio.";
    else if (!validarRut(form.run)) nuevosErrores.run = "RUN inválido. Verifica el dígito verificador.";
    else if (estudiantes.some((e) => e.run === normalizarRut(form.run))) nuevosErrores.run = "Ya existe un estudiante registrado con este RUN.";

    if (!form.nombres.trim()) nuevosErrores.nombres = "Los nombres son obligatorios.";
    if (!form.apellidoPaterno.trim()) nuevosErrores.apellidoPaterno = "El apellido paterno es obligatorio.";
    if (!form.apellidoMaterno.trim()) nuevosErrores.apellidoMaterno = "El apellido materno es obligatorio.";

    if (form.email.trim() && !validarEmail(form.email)) nuevosErrores.email = "Correo electrónico inválido.";
    if (form.telefono.trim() && !validarTelefonoChileno(form.telefono)) nuevosErrores.telefono = "Teléfono inválido. Usa formato chileno, ej: +56 9 1234 5678.";

    if (!form.anioAcademico.trim()) nuevosErrores.anioAcademico = "Selecciona el año académico.";
    if (!form.nivel) nuevosErrores.nivel = "Selecciona un nivel.";
    if (!form.especialidadId) nuevosErrores.especialidadId = "Selecciona una especialidad.";

    if (form.apoderadoEmail.trim() && !validarEmail(form.apoderadoEmail)) nuevosErrores.apoderadoEmail = "Correo electrónico inválido.";
    if (form.apoderadoTelefono.trim() && !validarTelefonoChileno(form.apoderadoTelefono)) nuevosErrores.apoderadoTelefono = "Teléfono inválido. Usa formato chileno, ej: +56 9 1234 5678.";
    if (form.apoderadoRun.trim() && !validarRut(form.apoderadoRun)) nuevosErrores.apoderadoRun = "RUN inválido. Verifica el dígito verificador.";

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function intentarRegistrar(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    setConfirmando(true);
  }

  async function confirmarRegistro() {
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
        apoderadoNombre: form.apoderadoNombre.trim(),
        apoderadoRun: form.apoderadoRun.trim() ? normalizarRut(form.apoderadoRun) : "",
        apoderadoParentesco: form.apoderadoParentesco,
        apoderadoTelefono: form.apoderadoTelefono.trim(),
        apoderadoEmail: form.apoderadoEmail.trim(),
        observaciones: form.observaciones.trim(),
        creadoEn: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "estudiantes"), nuevo);
      const guardado = { id: ref.id, ...nuevo } as Estudiante;
      setEstudiantes((prev) => [...prev, guardado]);
      setRegistrado(guardado);
      setConfirmando(false);
      setForm(EMPTY);
      setOtrosMedicos([]);
      setRasgos([]);
      setErrores({});
    } catch {
      setErrorSistema("No fue posible registrar al estudiante. Intenta nuevamente.");
      setConfirmando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">Agregar estudiante</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Registra un nuevo estudiante en SIGEDUAL y completa su información académica.
          </p>
        </div>
        <Link
          href="/dashboard/estudiantes"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver al listado
        </Link>
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
            <div style={{ background: s.color + "22", borderRadius: 10 }} className="w-9 h-9 flex items-center justify-center">
              <span style={{ color: s.color }}>{s.icon}</span>
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

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {/* Formulario */}
      <form
        onSubmit={intentarRegistrar}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        className="rounded-2xl p-5 sm:p-8"
      >
        <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-6">Información del estudiante</h2>

        <Seccion icon={<BadgeCheck size={16} />} titulo="Identificación">
          <Campo label="RUN" error={errores.run}>
            <input value={form.run} onChange={(e) => set("run", formatearRut(e.target.value))} placeholder="12.345.678-9" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Nombres" error={errores.nombres}>
            <input value={form.nombres} onChange={(e) => set("nombres", e.target.value)} placeholder="Juan Andrés" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Apellido paterno" error={errores.apellidoPaterno}>
            <input value={form.apellidoPaterno} onChange={(e) => set("apellidoPaterno", e.target.value)} placeholder="González" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Apellido materno" error={errores.apellidoMaterno}>
            <input value={form.apellidoMaterno} onChange={(e) => set("apellidoMaterno", e.target.value)} placeholder="Pérez" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Fecha de nacimiento" error={errores.fechaNacimiento}>
            <input type="date" value={form.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Sexo/Género" error={errores.sexo}>
            <select value={form.sexo} onChange={(e) => set("sexo", e.target.value)} style={inputStyle} className={inputClass}>
              <option value="">Selecciona una opción</option>
              <option value="Femenino">Femenino</option>
              <option value="Masculino">Masculino</option>
              <option value="Otro">Otro</option>
            </select>
          </Campo>
        </Seccion>

        <Seccion icon={<Phone size={16} />} titulo="Información de contacto">
          <Campo label="Correo electrónico" error={errores.email}>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="estudiante@email.com" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Teléfono" error={errores.telefono}>
            <input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Dirección" error={errores.direccion} span>
            <input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Calle, número" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Comuna" error={errores.comuna}>
            <input value={form.comuna} onChange={(e) => set("comuna", e.target.value)} placeholder="Comuna" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Ciudad" error={errores.ciudad}>
            <input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} placeholder="Ciudad" style={inputStyle} className={inputClass} />
          </Campo>
        </Seccion>

        <Seccion icon={<GraduationCap size={16} />} titulo="Información académica">
          <Campo label="Año académico" error={errores.anioAcademico}>
            <select value={form.anioAcademico} onChange={(e) => set("anioAcademico", e.target.value)} style={inputStyle} className={inputClass}>
              {ANIOS_ACADEMICOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Campo>
          <Campo label="Nivel" error={errores.nivel}>
            <select value={form.nivel} onChange={(e) => cambiarNivel(e.target.value)} style={inputStyle} className={inputClass}>
              <option value="">Selecciona un nivel</option>
              {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Campo>
          <Campo label="Curso (opcional)" error={errores.curso}>
            <select value={form.curso} onChange={(e) => set("curso", e.target.value)} disabled={!form.nivel} style={inputStyle} className={inputClass}>
              <option value="">{form.nivel ? "Selecciona un curso (opcional)" : "Selecciona primero un nivel"}</option>
              {cursosDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="Especialidad" error={errores.especialidadId}>
            <select value={form.especialidadId} onChange={(e) => set("especialidadId", e.target.value)} style={inputStyle} className={inputClass}>
              <option value="">{especialidades.length === 0 ? "No hay especialidades registradas" : "Selecciona una especialidad"}</option>
              {especialidades.map((esp) => <option key={esp.id} value={esp.id}>{esp.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Jornada" error={errores.jornada}>
            <select value={form.jornada} onChange={(e) => set("jornada", e.target.value)} style={inputStyle} className={inputClass}>
              <option value="">Selecciona una jornada</option>
              {JORNADAS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </Campo>
          <Campo label="Estado del estudiante" error={errores.estado}>
            <select value={form.estado} onChange={(e) => set("estado", e.target.value as Estudiante["estado"])} style={inputStyle} className={inputClass}>
              {ESTADOS.map((es) => <option key={es} value={es}>{es.charAt(0).toUpperCase() + es.slice(1)}</option>)}
            </select>
          </Campo>
        </Seccion>

        <Seccion
          icon={<HeartPulse size={16} />}
          titulo="Información médica"
          subtitulo="Enfermedades crónicas, alergias u otra información relevante para el bienestar del estudiante."
        >
          <Campo label="Enfermedades crónicas" error={errores.enfermedadesCronicas}>
            <input value={form.enfermedadesCronicas} onChange={(e) => set("enfermedadesCronicas", e.target.value)} placeholder="Ej: Asma, diabetes, epilepsia..." style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Alergias" error={errores.alergias}>
            <input value={form.alergias} onChange={(e) => set("alergias", e.target.value)} placeholder="Ej: Alergia a penicilina, polen..." style={inputStyle} className={inputClass} />
          </Campo>

          {otrosMedicos.map((valor, i) => (
            <div key={i} className="sm:col-span-2 flex gap-2 items-center">
              <input
                value={valor}
                onChange={(e) => actualizarOtroMedico(i, e.target.value)}
                placeholder="Otra información médica relevante..."
                style={inputStyle}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => quitarOtroMedico(i)}
                title="Quitar"
                style={{ color: "var(--danger)" }}
                className="p-2 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={agregarOtroMedico}
              style={{ color: "var(--accent-blue-light)" }}
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <Plus size={15} />
              Agregar otro dato médico
            </button>
          </div>
        </Seccion>

        <Seccion icon={<Users size={16} />} titulo="Información del apoderado">
          <Campo label="Nombre completo" error={errores.apoderadoNombre}>
            <input value={form.apoderadoNombre} onChange={(e) => set("apoderadoNombre", e.target.value)} placeholder="Nombre del apoderado" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="RUN" error={errores.apoderadoRun}>
            <input value={form.apoderadoRun} onChange={(e) => set("apoderadoRun", formatearRut(e.target.value))} placeholder="12.345.678-9" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Parentesco" error={errores.apoderadoParentesco}>
            <select value={form.apoderadoParentesco} onChange={(e) => set("apoderadoParentesco", e.target.value)} style={inputStyle} className={inputClass}>
              <option value="">Selecciona una opción</option>
              {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Campo>
          <Campo label="Teléfono" error={errores.apoderadoTelefono}>
            <input value={form.apoderadoTelefono} onChange={(e) => set("apoderadoTelefono", e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Correo electrónico" error={errores.apoderadoEmail} span>
            <input type="email" value={form.apoderadoEmail} onChange={(e) => set("apoderadoEmail", e.target.value)} placeholder="apoderado@email.com" style={inputStyle} className={inputClass} />
          </Campo>
        </Seccion>

        <Seccion
          icon={<Sparkles size={16} />}
          titulo="Características y habilidades"
          subtitulo="Ayudan a definir el centro dual más adecuado para el estudiante (por ejemplo, un estudiante más nervioso puede adaptarse mejor a un centro con un ambiente tranquilo)."
        >
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            {RASGOS.map((r) => {
              const activo = rasgos.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRasgo(r)}
                  style={{
                    background: activo ? "var(--accent-blue)" : "var(--bg-surface)",
                    border: `1px solid ${activo ? "var(--accent-blue)" : "var(--border)"}`,
                    color: activo ? "#fff" : "var(--text-secondary)",
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                >
                  {r}
                </button>
              );
            })}
          </div>
        </Seccion>

        <Seccion icon={<FileText size={16} />} titulo="Observaciones">
          <div className="sm:col-span-2">
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Información adicional (opcional)</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => set("observaciones", e.target.value)}
              placeholder="Notas relevantes sobre el estudiante..."
              rows={4}
              style={inputStyle}
              className={`${inputClass} resize-none`}
            />
          </div>
        </Seccion>

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/estudiantes")}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            style={{ background: "var(--accent-blue)" }}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Agregar estudiante"}
          </button>
        </div>
      </form>

      {/* Modal de confirmación */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Agregar estudiante?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Estás a punto de registrar a <strong style={{ color: "var(--text-primary)" }}>{form.nombres} {form.apellidoPaterno} {form.apellidoMaterno}</strong> en SIGEDUAL.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={guardando}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRegistro}
                disabled={guardando}
                style={{ background: "var(--accent-blue)" }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Confirmar registro"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                href="/dashboard/estudiantes"
                style={{ background: "var(--accent-blue)" }}
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
