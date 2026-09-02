"use client";
import { useState } from "react";
import {
  Users, BadgeCheck, Phone, GraduationCap, HeartPulse, Sparkles, FileText, Plus, X,
} from "lucide-react";
import { formatearRut, normalizarRut, validarRut, validarEmail, validarTelefonoChileno } from "@/lib/rut";
import type { Estudiante, Especialidad } from "@/types";

const NIVELES = ["1° Medio", "2° Medio", "3° Medio", "4° Medio"];
const LETRAS_CURSO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const JORNADAS = ["Diurna", "Vespertina", "Jornada Completa", "Otro"];
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

export interface EstudianteFormValues {
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

export const ESTUDIANTE_FORM_VACIO: EstudianteFormValues = {
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
    <div className={span ? "sm:col-span-2" : ""} data-error={error ? "true" : "false"}>
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

interface EstudianteFormProps {
  modo: "crear" | "editar";
  valoresIniciales: EstudianteFormValues;
  otrosMedicosIniciales: string[];
  rasgosIniciales: string[];
  especialidades: Especialidad[];
  runsOcupados: string[];
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (valores: EstudianteFormValues, otrosMedicos: string[], rasgos: string[]) => void | Promise<void>;
}

export default function EstudianteForm({
  modo, valoresIniciales, otrosMedicosIniciales, rasgosIniciales, especialidades,
  runsOcupados, guardando, onCancelar, onGuardar,
}: EstudianteFormProps) {
  const [form, setForm] = useState<EstudianteFormValues>(valoresIniciales);
  const [errores, setErrores] = useState<Partial<Record<keyof EstudianteFormValues, string>>>({});
  const [otrosMedicos, setOtrosMedicos] = useState<string[]>(otrosMedicosIniciales);
  const [rasgos, setRasgos] = useState<string[]>(rasgosIniciales);
  const [formularioInvalido, setFormularioInvalido] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const cursosDisponibles = form.nivel ? LETRAS_CURSO.map((letra) => `${form.nivel} ${letra}`) : [];

  function set<K extends keyof EstudianteFormValues>(key: K, value: EstudianteFormValues[K]) {
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
    const nuevosErrores: Partial<Record<keyof EstudianteFormValues, string>> = {};

    if (!form.run.trim()) nuevosErrores.run = "El RUN es obligatorio.";
    else if (!validarRut(form.run)) nuevosErrores.run = "RUN inválido. Verifica el dígito verificador.";
    else if (runsOcupados.includes(normalizarRut(form.run))) nuevosErrores.run = "Ya existe un estudiante registrado con este RUN.";

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

  function intentarGuardar(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) {
      setFormularioInvalido(true);
      const primerCampoConError = document.querySelector('[data-error="true"]');
      primerCampoConError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFormularioInvalido(false);
    if (modo === "crear") {
      setConfirmando(true);
    } else {
      onGuardar(form, otrosMedicos, rasgos);
    }
  }

  return (
    <>
      <form onSubmit={intentarGuardar} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8">
        {formularioInvalido && (
          <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
            <p style={{ color: "var(--danger)" }} className="text-sm font-medium">Revisa los campos marcados en rojo antes de continuar.</p>
          </div>
        )}

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
            onClick={onCancelar}
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
            {guardando ? "Guardando..." : modo === "crear" ? "Agregar estudiante" : "Guardar cambios"}
          </button>
        </div>
      </form>

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
                onClick={() => onGuardar(form, otrosMedicos, rasgos)}
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
    </>
  );
}
