"use client";
import { useEffect, useState } from "react";
import {
  BadgeCheck, Phone, GraduationCap, HeartPulse, Users, Sparkles, CheckCircle2,
  ArrowLeft, ArrowRight, Plus, X,
} from "lucide-react";
import { formatearRut, normalizarRut, validarRut, validarEmail, validarTelefonoChileno } from "@/lib/rut";
import { RASGOS_ESTUDIANTE, HABILIDADES } from "@/lib/caracteristicas";
import Select from "@/components/ui/Select";
import type { Estudiante, Especialidad } from "@/types";

const NIVELES = ["1° Medio", "2° Medio", "3° Medio", "4° Medio"];
const LETRAS_CURSO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const JORNADAS = ["Diurna", "Vespertina", "Jornada Completa", "Otro"];
const ESTADOS: Estudiante["estado"][] = ["activo", "inactivo", "egresado", "retirado"];
const PARENTESCOS = ["Padre", "Madre", "Tutor legal", "Otro"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_ACADEMICOS = Array.from({ length: 5 }, (_, i) => ANIO_ACTUAL + i);

export interface EstudianteFormValues {
  run: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  sexo: string;
  nacionalidad: string;
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
  apoderadoDomicilio: string;
  apoderadoCiudad: string;
  observaciones: string;
}

export const ESTUDIANTE_FORM_VACIO: EstudianteFormValues = {
  run: "", nombres: "", apellidoPaterno: "", apellidoMaterno: "",
  fechaNacimiento: "", sexo: "", nacionalidad: "",
  email: "", telefono: "", direccion: "", comuna: "", ciudad: "",
  anioAcademico: String(ANIO_ACTUAL), nivel: "", curso: "",
  especialidadId: "", jornada: "", estado: "activo",
  enfermedadesCronicas: "", alergias: "",
  apoderadoNombre: "", apoderadoRun: "", apoderadoParentesco: "",
  apoderadoTelefono: "", apoderadoEmail: "", apoderadoDomicilio: "", apoderadoCiudad: "",
  observaciones: "",
};

type Errores = Partial<Record<keyof EstudianteFormValues, string>>;

function Seccion({
  icon, titulo, subtitulo, children,
}: { icon: React.ReactNode; titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: "var(--accent-light)" }}>{icon}</span>
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
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors disabled:opacity-50";

interface EstudianteFormProps {
  modo: "crear" | "editar";
  valoresIniciales: EstudianteFormValues;
  otrosMedicosIniciales: string[];
  rasgosIniciales: string[];
  habilidadesIniciales: string[];
  especialidades: Especialidad[];
  runsOcupados: string[];
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (valores: EstudianteFormValues, otrosMedicos: string[], rasgos: string[], habilidades: string[]) => void | Promise<void>;
  onCambio?: (valores: EstudianteFormValues, otrosMedicos: string[], rasgos: string[], habilidades: string[]) => void;
}

export default function EstudianteForm({
  modo, valoresIniciales, otrosMedicosIniciales, rasgosIniciales, habilidadesIniciales, especialidades,
  runsOcupados, guardando, onCancelar, onGuardar, onCambio,
}: EstudianteFormProps) {
  const [form, setForm] = useState<EstudianteFormValues>(valoresIniciales);
  const [errores, setErrores] = useState<Errores>({});
  const [otrosMedicos, setOtrosMedicos] = useState<string[]>(otrosMedicosIniciales);
  const [rasgos, setRasgos] = useState<string[]>(rasgosIniciales);
  const [habilidades, setHabilidades] = useState<string[]>(habilidadesIniciales);
  const [formularioInvalido, setFormularioInvalido] = useState(false);
  const [paso, setPaso] = useState(1);

  useEffect(() => {
    onCambio?.(form, otrosMedicos, rasgos, habilidades);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, otrosMedicos, rasgos, habilidades]);

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

  function toggleHabilidad(habilidad: string) {
    setHabilidades((prev) => (prev.includes(habilidad) ? prev.filter((h) => h !== habilidad) : [...prev, habilidad]));
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

  function validarPaso1(): Errores {
    const errs: Errores = {};
    if (!form.run.trim()) errs.run = "El RUN es obligatorio.";
    else if (!validarRut(form.run)) errs.run = "RUN inválido. Verifica el dígito verificador.";
    else if (runsOcupados.includes(normalizarRut(form.run))) errs.run = "Ya existe un estudiante registrado con este RUN.";
    if (!form.nombres.trim()) errs.nombres = "Los nombres son obligatorios.";
    if (!form.apellidoPaterno.trim()) errs.apellidoPaterno = "El apellido paterno es obligatorio.";
    if (!form.apellidoMaterno.trim()) errs.apellidoMaterno = "El apellido materno es obligatorio.";
    return errs;
  }

  function validarPaso2(): Errores {
    const errs: Errores = {};
    if (form.email.trim() && !validarEmail(form.email)) errs.email = "Correo electrónico inválido.";
    if (form.telefono.trim() && !validarTelefonoChileno(form.telefono)) errs.telefono = "Teléfono inválido. Usa formato chileno, ej: +56 9 1234 5678.";
    return errs;
  }

  function validarPaso3(): Errores {
    const errs: Errores = {};
    if (!form.anioAcademico.trim()) errs.anioAcademico = "Selecciona el año académico.";
    if (!form.nivel) errs.nivel = "Selecciona un nivel.";
    if (!form.especialidadId) errs.especialidadId = "Selecciona una especialidad.";
    return errs;
  }

  function validarPaso5(): Errores {
    const errs: Errores = {};
    if (form.apoderadoEmail.trim() && !validarEmail(form.apoderadoEmail)) errs.apoderadoEmail = "Correo electrónico inválido.";
    if (form.apoderadoTelefono.trim() && !validarTelefonoChileno(form.apoderadoTelefono)) errs.apoderadoTelefono = "Teléfono inválido. Usa formato chileno, ej: +56 9 1234 5678.";
    if (form.apoderadoRun.trim() && !validarRut(form.apoderadoRun)) errs.apoderadoRun = "RUN inválido. Verifica el dígito verificador.";
    return errs;
  }

  function irAlPrimerError() {
    setFormularioInvalido(true);
    const primerCampoConError = document.querySelector('[data-error="true"]');
    primerCampoConError?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function intentarAvanzar() {
    let errs: Errores = {};
    if (paso === 1) errs = validarPaso1();
    else if (paso === 2) errs = validarPaso2();
    else if (paso === 3) errs = validarPaso3();
    else if (paso === 5) errs = validarPaso5();
    setErrores(errs);
    if (Object.keys(errs).length > 0) {
      irAlPrimerError();
      return;
    }
    setFormularioInvalido(false);
    setPaso((p) => p + 1);
  }

  function guardarFinal() {
    onGuardar(form, otrosMedicos, rasgos, habilidades);
  }

  function intentarGuardarEditar(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errores = { ...validarPaso1(), ...validarPaso2(), ...validarPaso3(), ...validarPaso5() };
    setErrores(errs);
    if (Object.keys(errs).length > 0) {
      irAlPrimerError();
      return;
    }
    setFormularioInvalido(false);
    guardarFinal();
  }

  const seccionIdentificacion = (
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
        <Select value={form.sexo} onChange={(v) => set("sexo", v)} ariaLabel="Sexo/Género"
          opciones={[
            { value: "", label: "Selecciona una opción" },
            { value: "Femenino", label: "Femenino" },
            { value: "Masculino", label: "Masculino" },
            { value: "Otro", label: "Otro" },
          ]} />
      </Campo>
      <Campo label="Nacionalidad" error={errores.nacionalidad}>
        <input value={form.nacionalidad} onChange={(e) => set("nacionalidad", e.target.value)} placeholder="Chilena" style={inputStyle} className={inputClass} />
      </Campo>
    </Seccion>
  );

  const seccionContacto = (
    <Seccion icon={<Phone size={16} />} titulo="Contacto">
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
  );

  const seccionAcademica = (
    <Seccion icon={<GraduationCap size={16} />} titulo="Información académica">
      <Campo label="Año académico" error={errores.anioAcademico}>
        <Select value={form.anioAcademico} onChange={(v) => set("anioAcademico", v)} ariaLabel="Año académico"
          opciones={ANIOS_ACADEMICOS.map((a) => ({ value: String(a), label: String(a) }))} />
      </Campo>
      <Campo label="Nivel" error={errores.nivel}>
        <Select value={form.nivel} onChange={cambiarNivel} ariaLabel="Nivel"
          opciones={[{ value: "", label: "Selecciona un nivel" }, ...NIVELES.map((n) => ({ value: n, label: n }))]} />
      </Campo>
      <Campo label="Curso (opcional)" error={errores.curso}>
        <Select value={form.curso} onChange={(v) => set("curso", v)} disabled={!form.nivel} ariaLabel="Curso"
          opciones={[
            { value: "", label: form.nivel ? "Selecciona un curso (opcional)" : "Selecciona primero un nivel" },
            ...cursosDisponibles.map((c) => ({ value: c, label: c })),
          ]} />
      </Campo>
      <Campo label="Especialidad" error={errores.especialidadId}>
        <Select value={form.especialidadId} onChange={(v) => set("especialidadId", v)} ariaLabel="Especialidad"
          opciones={[
            { value: "", label: especialidades.length === 0 ? "No hay especialidades registradas" : "Selecciona una especialidad" },
            ...especialidades.map((esp) => ({ value: esp.id, label: esp.nombre })),
          ]} />
      </Campo>
      <Campo label="Jornada" error={errores.jornada}>
        <Select value={form.jornada} onChange={(v) => set("jornada", v)} ariaLabel="Jornada"
          opciones={[{ value: "", label: "Selecciona una jornada" }, ...JORNADAS.map((j) => ({ value: j, label: j }))]} />
      </Campo>
      <Campo label="Estado del estudiante" error={errores.estado}>
        <Select value={form.estado} onChange={(v) => set("estado", v as Estudiante["estado"])} ariaLabel="Estado del estudiante"
          opciones={ESTADOS.map((es) => ({ value: es, label: es.charAt(0).toUpperCase() + es.slice(1) }))} />
      </Campo>
    </Seccion>
  );

  const seccionMedica = (
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
          style={{ color: "var(--accent-light)" }}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <Plus size={15} />
          Agregar otro dato médico
        </button>
      </div>
    </Seccion>
  );

  const seccionApoderado = (
    <Seccion icon={<Users size={16} />} titulo="Apoderado">
      <Campo label="Nombre completo" error={errores.apoderadoNombre}>
        <input value={form.apoderadoNombre} onChange={(e) => set("apoderadoNombre", e.target.value)} placeholder="Nombre del apoderado" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="RUN" error={errores.apoderadoRun}>
        <input value={form.apoderadoRun} onChange={(e) => set("apoderadoRun", formatearRut(e.target.value))} placeholder="12.345.678-9" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Parentesco" error={errores.apoderadoParentesco}>
        <Select value={form.apoderadoParentesco} onChange={(v) => set("apoderadoParentesco", v)} ariaLabel="Parentesco"
          opciones={[{ value: "", label: "Selecciona una opción" }, ...PARENTESCOS.map((p) => ({ value: p, label: p }))]} />
      </Campo>
      <Campo label="Teléfono" error={errores.apoderadoTelefono}>
        <input value={form.apoderadoTelefono} onChange={(e) => set("apoderadoTelefono", e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Correo electrónico" error={errores.apoderadoEmail} span>
        <input type="email" value={form.apoderadoEmail} onChange={(e) => set("apoderadoEmail", e.target.value)} placeholder="apoderado@email.com" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Domicilio" error={errores.apoderadoDomicilio}>
        <input value={form.apoderadoDomicilio} onChange={(e) => set("apoderadoDomicilio", e.target.value)} placeholder="Calle, número" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Ciudad" error={errores.apoderadoCiudad}>
        <input value={form.apoderadoCiudad} onChange={(e) => set("apoderadoCiudad", e.target.value)} placeholder="Ciudad" style={inputStyle} className={inputClass} />
      </Campo>
    </Seccion>
  );

  const seccionCaracteristicas = (
    <Seccion
      icon={<Sparkles size={16} />}
      titulo="Características y observaciones"
      subtitulo="Ayudan a definir el centro dual más adecuado para el estudiante (por ejemplo, un estudiante más nervioso puede adaptarse mejor a un centro con un ambiente tranquilo)."
    >
      <div className="sm:col-span-2">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-2">Rasgos</p>
        <div className="flex flex-wrap gap-2">
          {RASGOS_ESTUDIANTE.map((r) => {
            const activo = rasgos.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRasgo(r)}
                style={{
                  background: activo ? "var(--accent)" : "var(--bg-surface)",
                  border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`,
                  color: activo ? "var(--text-on-accent)" : "var(--text-secondary)",
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sm:col-span-2 mt-4">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-1">Habilidades</p>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">Habilidades que el estudiante ya domina o está desarrollando.</p>
        <div className="flex flex-wrap gap-2">
          {HABILIDADES.map((h) => {
            const activo = habilidades.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggleHabilidad(h)}
                style={{
                  background: activo ? "var(--accent)" : "var(--bg-surface)",
                  border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`,
                  color: activo ? "var(--text-on-accent)" : "var(--text-secondary)",
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>

      <Campo label="Observaciones (opcional)" error={errores.observaciones} span>
        <textarea
          value={form.observaciones}
          onChange={(e) => set("observaciones", e.target.value)}
          placeholder="Notas relevantes sobre el estudiante..."
          rows={4}
          style={inputStyle}
          className={`${inputClass} resize-none`}
        />
      </Campo>
    </Seccion>
  );

  const resumen = (
    <div className="flex flex-col gap-4">
      {[
        {
          titulo: "Identificación",
          filas: [
            ["Nombre", `${form.nombres} ${form.apellidoPaterno} ${form.apellidoMaterno}`.trim() || "—"],
            ["RUN", form.run || "—"],
            ["Fecha de nacimiento", form.fechaNacimiento || "No registrada"],
            ["Sexo/Género", form.sexo || "No registrado"],
            ["Nacionalidad", form.nacionalidad || "No registrada"],
          ],
        },
        {
          titulo: "Contacto",
          filas: [
            ["Correo", form.email || "No registrado"],
            ["Teléfono", form.telefono || "No registrado"],
            ["Dirección", [form.direccion, form.comuna, form.ciudad].filter(Boolean).join(", ") || "No registrada"],
          ],
        },
        {
          titulo: "Información académica",
          filas: [
            ["Año académico", form.anioAcademico || "—"],
            ["Nivel", form.nivel || "—"],
            ["Curso", form.curso || "No definido"],
            ["Especialidad", especialidades.find((e) => e.id === form.especialidadId)?.nombre || "—"],
            ["Jornada", form.jornada || "No definida"],
            ["Estado", form.estado],
          ],
        },
        {
          titulo: "Información médica",
          filas: [
            ["Enfermedades crónicas", form.enfermedadesCronicas || "Ninguna registrada"],
            ["Alergias", form.alergias || "Ninguna registrada"],
            ["Otros datos", otrosMedicos.filter((v) => v.trim()).join(", ") || "Ninguno"],
          ],
        },
        {
          titulo: "Apoderado",
          filas: [
            ["Nombre", form.apoderadoNombre || "No registrado"],
            ["RUN", form.apoderadoRun || "No registrado"],
            ["Parentesco", form.apoderadoParentesco || "No registrado"],
            ["Teléfono", form.apoderadoTelefono || "No registrado"],
            ["Correo", form.apoderadoEmail || "No registrado"],
            ["Domicilio", [form.apoderadoDomicilio, form.apoderadoCiudad].filter(Boolean).join(", ") || "No registrado"],
          ],
        },
        {
          titulo: "Características y observaciones",
          filas: [
            ["Rasgos", rasgos.length ? rasgos.join(", ") : "Ninguno seleccionado"],
            ["Habilidades", habilidades.length ? habilidades.join(", ") : "Ninguna seleccionada"],
            ["Observaciones", form.observaciones.trim() || "Sin observaciones"],
          ],
        },
      ].map((bloque) => (
        <div key={bloque.titulo} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-2">{bloque.titulo}</p>
          <div className="flex flex-col gap-1">
            {bloque.filas.map(([label, valor]) => (
              <p key={label} style={{ color: "var(--text-secondary)" }} className="text-xs">
                <span style={{ color: "var(--text-muted)" }}>{label}: </span>{valor}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // --- Modo editar: formulario plano ---
  if (modo === "editar") {
    return (
      <form onSubmit={intentarGuardarEditar} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8">
        {formularioInvalido && (
          <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
            <p style={{ color: "var(--danger)" }} className="text-sm font-medium">Revisa los campos marcados en rojo antes de continuar.</p>
          </div>
        )}
        {seccionIdentificacion}
        {seccionContacto}
        {seccionAcademica}
        {seccionMedica}
        {seccionApoderado}
        {seccionCaracteristicas}
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button type="button" onClick={onCancelar}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    );
  }

  // --- Modo crear: asistente de 7 pasos ---
  const PASOS = ["Identificación", "Contacto", "Información académica", "Información médica", "Apoderado", "Características y observaciones", "Revisión"];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {PASOS.map((p, i) => {
          const num = i + 1;
          const activo = paso === num;
          const completado = paso > num;
          return (
            <div key={p} className="flex items-center gap-2 flex-shrink-0">
              <div
                style={{
                  background: activo || completado ? "var(--accent)" : "var(--bg-surface)",
                  color: activo || completado ? "var(--text-on-accent)" : "var(--text-muted)",
                  border: `1px solid ${activo || completado ? "var(--accent)" : "var(--border)"}`,
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              >
                {completado ? <CheckCircle2 size={14} /> : num}
              </div>
              <span style={{ color: activo ? "var(--text-primary)" : "var(--text-muted)" }} className="text-xs font-medium whitespace-nowrap">{p}</span>
              {i < PASOS.length - 1 && <div style={{ background: "var(--border)" }} className="w-6 h-px" />}
            </div>
          );
        })}
      </div>

      {formularioInvalido && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">Revisa los campos marcados en rojo antes de continuar.</p>
        </div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8">
        {paso === 1 && seccionIdentificacion}
        {paso === 2 && seccionContacto}
        {paso === 3 && seccionAcademica}
        {paso === 4 && seccionMedica}
        {paso === 5 && seccionApoderado}
        {paso === 6 && seccionCaracteristicas}
        {paso === 7 && (
          <div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Revisar estudiante</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-5">Revisa la información antes de crear el registro.</p>
            {resumen}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={() => (paso === 1 ? onCancelar() : setPaso((p) => p - 1))}
            disabled={guardando}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            {paso === 1 ? "Cancelar" : paso === 7 ? "Volver y editar" : "Volver"}
          </button>
          {paso < 7 ? (
            <button
              type="button"
              onClick={intentarAvanzar}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Continuar
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={guardarFinal}
              disabled={guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {guardando ? "Creando..." : "Agregar estudiante"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
