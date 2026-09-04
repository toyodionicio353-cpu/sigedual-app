"use client";
import { useState } from "react";
import {
  Building2, MapPin, GraduationCap, Sparkles, CalendarCheck, CheckCircle2,
  ArrowLeft, ArrowRight, UserRound,
} from "lucide-react";
import { formatearRut, normalizarRut, validarRut, validarEmail, validarTelefonoChileno } from "@/lib/rut";
import { AMBIENTES_CENTRO, HABILIDADES, AREAS_DESEMPENO } from "@/lib/caracteristicas";
import { REGIONES } from "@/app/dashboard/liceos/_components/LiceoForm";
import Select from "@/components/ui/Select";
import type { Especialidad, TipoCentroDual, EstadoCentroDual } from "@/types";

const TIPOS_CENTRO: { value: TipoCentroDual; label: string }[] = [
  { value: "empresa", label: "Empresa" },
  { value: "institucion", label: "Institución" },
  { value: "organizacion", label: "Organización" },
  { value: "otro", label: "Otro" },
];

const ESTADOS_CENTRO: { value: EstadoCentroDual; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "en_revision", label: "En revisión" },
];

export interface CentroDualFormValues {
  nombre: string;
  rut: string;
  tipo: TipoCentroDual;
  razonSocial: string;
  nombreComercial: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  region: string;
  telefono: string;
  email: string;
  sitioWeb: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
  contactoEmail: string;
  capacidad: string;
  estado: EstadoCentroDual;
}

export const CENTRO_FORM_VACIO: CentroDualFormValues = {
  nombre: "", rut: "", tipo: "empresa", razonSocial: "", nombreComercial: "",
  direccion: "", comuna: "", ciudad: "", region: "",
  telefono: "", email: "", sitioWeb: "",
  contactoNombre: "", contactoCargo: "", contactoTelefono: "", contactoEmail: "",
  capacidad: "", estado: "activo",
};

type Errores = Partial<Record<keyof CentroDualFormValues, string>>;

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

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors disabled:opacity-50";

interface CentroDualFormProps {
  modo: "crear" | "editar";
  valoresIniciales: CentroDualFormValues;
  especialidadesIniciales: string[];
  areasIniciales: string[];
  caracteristicasIniciales: string[];
  habilidadesIniciales: string[];
  especialidadesDisponibles: Especialidad[];
  rutsOcupados: string[];
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (
    valores: CentroDualFormValues,
    especialidades: string[],
    areas: string[],
    caracteristicas: string[],
    habilidades: string[]
  ) => void | Promise<void>;
}

export default function CentroDualForm({
  modo, valoresIniciales, especialidadesIniciales, areasIniciales, caracteristicasIniciales, habilidadesIniciales,
  especialidadesDisponibles, rutsOcupados, guardando, onCancelar, onGuardar,
}: CentroDualFormProps) {
  const [form, setForm] = useState<CentroDualFormValues>(valoresIniciales);
  const [especialidadesSel, setEspecialidadesSel] = useState<string[]>(especialidadesIniciales);
  const [areasSel, setAreasSel] = useState<string[]>(areasIniciales);
  const [caracteristicasSel, setCaracteristicasSel] = useState<string[]>(caracteristicasIniciales);
  const [habilidadesSel, setHabilidadesSel] = useState<string[]>(habilidadesIniciales);
  const [errores, setErrores] = useState<Errores>({});
  const [errorEspecialidades, setErrorEspecialidades] = useState("");
  const [paso, setPaso] = useState(1);
  const [formularioInvalido, setFormularioInvalido] = useState(false);

  function set<K extends keyof CentroDualFormValues>(key: K, value: CentroDualFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errores[key]) setErrores((e) => ({ ...e, [key]: undefined }));
  }

  function toggleEspecialidad(id: string) {
    setEspecialidadesSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (errorEspecialidades) setErrorEspecialidades("");
  }
  function toggleArea(a: string) {
    setAreasSel((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }
  function toggleCaracteristica(c: string) {
    setCaracteristicasSel((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }
  function toggleHabilidad(h: string) {
    setHabilidadesSel((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  }

  function validarPaso1(): Errores {
    const errs: Errores = {};
    if (!form.nombre.trim()) errs.nombre = "El nombre del centro es obligatorio.";
    if (form.rut.trim()) {
      if (!validarRut(form.rut)) errs.rut = "RUT inválido. Verifica el dígito verificador.";
      else if (rutsOcupados.includes(normalizarRut(form.rut))) errs.rut = "Ya existe un centro registrado con este RUT.";
    }
    return errs;
  }

  function validarPaso2(): Errores {
    const errs: Errores = {};
    if (!form.direccion.trim()) errs.direccion = "La dirección es obligatoria.";
    if (!form.comuna.trim()) errs.comuna = "La comuna es obligatoria.";
    if (!form.region.trim()) errs.region = "Selecciona una región.";
    if (form.email.trim() && !validarEmail(form.email)) errs.email = "Correo electrónico inválido.";
    if (form.telefono.trim() && !validarTelefonoChileno(form.telefono)) errs.telefono = "Teléfono inválido. Usa formato chileno, ej: +56 2 1234 5678.";
    if (form.contactoEmail.trim() && !validarEmail(form.contactoEmail)) errs.contactoEmail = "Correo electrónico inválido.";
    if (form.contactoTelefono.trim() && !validarTelefonoChileno(form.contactoTelefono)) errs.contactoTelefono = "Teléfono inválido. Usa formato chileno, ej: +56 9 1234 5678.";
    return errs;
  }

  function validarPaso3(): { errs: Errores; errEsp: string } {
    const errs: Errores = {};
    if (form.capacidad.trim()) {
      const n = Number(form.capacidad);
      if (!Number.isInteger(n) || n < 0) errs.capacidad = "La capacidad no puede ser negativa.";
    }
    const errEsp = especialidadesDisponibles.length > 0 && especialidadesSel.length === 0
      ? "Selecciona al menos una especialidad que este centro pueda recibir."
      : "";
    return { errs, errEsp };
  }

  function especialidadNombre(id: string): string {
    return especialidadesDisponibles.find((e) => e.id === id)?.nombre || id;
  }

  function irAlPrimerError() {
    setFormularioInvalido(true);
    const primerCampoConError = document.querySelector('[data-error="true"]');
    primerCampoConError?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function intentarAvanzar() {
    let errs: Errores = {};
    let errEsp = "";
    if (paso === 1) errs = validarPaso1();
    else if (paso === 2) errs = validarPaso2();
    else if (paso === 3) {
      const r = validarPaso3();
      errs = r.errs;
      errEsp = r.errEsp;
    }
    setErrores(errs);
    setErrorEspecialidades(errEsp);
    if (Object.keys(errs).length > 0 || errEsp) {
      irAlPrimerError();
      return;
    }
    setFormularioInvalido(false);
    setPaso((p) => p + 1);
  }

  function guardarFinal() {
    onGuardar(form, especialidadesSel, areasSel, caracteristicasSel, habilidadesSel);
  }

  function intentarGuardarEditar(e: React.FormEvent) {
    e.preventDefault();
    const errsPaso3 = validarPaso3();
    const errs: Errores = { ...validarPaso1(), ...validarPaso2(), ...errsPaso3.errs };
    setErrores(errs);
    setErrorEspecialidades(errsPaso3.errEsp);
    if (Object.keys(errs).length > 0 || errsPaso3.errEsp) {
      irAlPrimerError();
      return;
    }
    setFormularioInvalido(false);
    guardarFinal();
  }

  // --- Bloques de secciones (reutilizados tanto en el asistente como en el formulario plano de edición) ---

  const seccionInformacionGeneral = (
    <Seccion icon={<Building2 size={16} />} titulo="Información general">
      <Campo label="Nombre del centro *" error={errores.nombre}>
        <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Empresa ABC Ltda." style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="RUT (opcional)" error={errores.rut}>
        <input value={form.rut} onChange={(e) => set("rut", formatearRut(e.target.value))} placeholder="76.123.456-7" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Tipo de centro" error={errores.tipo}>
        <Select value={form.tipo} onChange={(v) => set("tipo", v as TipoCentroDual)} ariaLabel="Tipo de centro"
          opciones={TIPOS_CENTRO} />
      </Campo>
      <Campo label="Razón social (opcional)" error={errores.razonSocial}>
        <input value={form.razonSocial} onChange={(e) => set("razonSocial", e.target.value)} placeholder="Razón social registrada" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Nombre comercial (opcional)" error={errores.nombreComercial} span>
        <input value={form.nombreComercial} onChange={(e) => set("nombreComercial", e.target.value)} placeholder="Nombre con el que se conoce al centro" style={inputStyle} className={inputClass} />
      </Campo>
    </Seccion>
  );

  const seccionUbicacionContacto = (
    <>
      <Seccion icon={<MapPin size={16} />} titulo="Ubicación y contacto">
        <Campo label="Dirección" error={errores.direccion} span>
          <input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Calle, número" style={inputStyle} className={inputClass} />
        </Campo>
        <Campo label="Comuna" error={errores.comuna}>
          <input value={form.comuna} onChange={(e) => set("comuna", e.target.value)} placeholder="Comuna" style={inputStyle} className={inputClass} />
        </Campo>
        <Campo label="Ciudad (opcional)" error={errores.ciudad}>
          <input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} placeholder="Ciudad" style={inputStyle} className={inputClass} />
        </Campo>
        <Campo label="Región" error={errores.region}>
          <Select value={form.region} onChange={(v) => set("region", v)} ariaLabel="Región"
            opciones={[{ value: "", label: "Selecciona una región" }, ...REGIONES.map((r) => ({ value: r, label: r }))]} />
        </Campo>
        <Campo label="Teléfono (opcional)" error={errores.telefono}>
          <input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+56 2 1234 5678" style={inputStyle} className={inputClass} />
        </Campo>
        <Campo label="Correo electrónico (opcional)" error={errores.email}>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contacto@empresa.cl" style={inputStyle} className={inputClass} />
        </Campo>
        <Campo label="Sitio web (opcional)" error={errores.sitioWeb}>
          <input value={form.sitioWeb} onChange={(e) => set("sitioWeb", e.target.value)} placeholder="https://empresa.cl" style={inputStyle} className={inputClass} />
        </Campo>
      </Seccion>

      <Seccion
        icon={<UserRound size={16} />}
        titulo="Contacto del centro"
        subtitulo="Persona de contacto administrativo. No es el Maestro Guía — a los maestros guía se les asocia después, desde Centros Duales → Lista de maestro guía."
      >
        <Campo label="Nombre (opcional)" error={errores.contactoNombre}>
          <input value={form.contactoNombre} onChange={(e) => set("contactoNombre", e.target.value)} placeholder="Nombre del contacto" style={inputStyle} className={inputClass} />
        </Campo>
        <Campo label="Cargo (opcional)" error={errores.contactoCargo}>
          <input value={form.contactoCargo} onChange={(e) => set("contactoCargo", e.target.value)} placeholder="Ej: Jefe de RR.HH." style={inputStyle} className={inputClass} />
        </Campo>
        <Campo label="Teléfono (opcional)" error={errores.contactoTelefono}>
          <input value={form.contactoTelefono} onChange={(e) => set("contactoTelefono", e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} className={inputClass} />
        </Campo>
        <Campo label="Correo electrónico (opcional)" error={errores.contactoEmail}>
          <input type="email" value={form.contactoEmail} onChange={(e) => set("contactoEmail", e.target.value)} placeholder="contacto@empresa.cl" style={inputStyle} className={inputClass} />
        </Campo>
      </Seccion>
    </>
  );

  const seccionFormacionDual = (
    <Seccion icon={<GraduationCap size={16} />} titulo="Formación dual">
      <div className="sm:col-span-2">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-1">Especialidades disponibles</p>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">Determina qué estudiantes puede recibir este centro según su especialidad.</p>
        {especialidadesDisponibles.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }} className="text-xs">Tu liceo aún no tiene especialidades registradas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {especialidadesDisponibles.map((esp) => {
              const activo = especialidadesSel.includes(esp.id);
              return (
                <button key={esp.id} type="button" onClick={() => toggleEspecialidad(esp.id)}
                  style={{ background: activo ? "var(--accent)" : "var(--bg-surface)", border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`, color: activo ? "var(--text-on-accent)" : "var(--text-secondary)" }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors">
                  {esp.nombre}
                </button>
              );
            })}
          </div>
        )}
        {errorEspecialidades && <p style={{ color: "var(--danger)" }} className="text-xs mt-2">{errorEspecialidades}</p>}
      </div>

      <div className="sm:col-span-2 mt-2">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-1">Áreas de desempeño</p>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">Áreas en las que el estudiante podría desempeñarse dentro del centro.</p>
        <div className="flex flex-wrap gap-2">
          {AREAS_DESEMPENO.map((a) => {
            const activo = areasSel.includes(a);
            return (
              <button key={a} type="button" onClick={() => toggleArea(a)}
                style={{ background: activo ? "var(--accent)" : "var(--bg-surface)", border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`, color: activo ? "var(--text-on-accent)" : "var(--text-secondary)" }}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors">
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <Campo label="Capacidad máxima de estudiantes (opcional)" error={errores.capacidad}>
        <input
          type="number"
          min={0}
          value={form.capacidad}
          onChange={(e) => set("capacidad", e.target.value)}
          placeholder="Sin límite si se deja vacío"
          style={inputStyle}
          className={inputClass}
        />
      </Campo>
    </Seccion>
  );

  const seccionCaracteristicasHabilidades = (
    <Seccion
      icon={<Sparkles size={16} />}
      titulo="Características y habilidades"
      subtitulo="Estas características ayudan a SIGEDUAL a identificar qué estudiantes podrían adaptarse mejor a este centro. Son descriptivas del ambiente de trabajo, no un diagnóstico de los estudiantes."
    >
      <div className="sm:col-span-2">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-3">Características del centro</p>
        <Pills opciones={AMBIENTES_CENTRO} seleccionadas={caracteristicasSel} onToggle={toggleCaracteristica} />
      </div>
      <div className="sm:col-span-2 mt-4">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-3">Habilidades valoradas</p>
        <Pills opciones={HABILIDADES} seleccionadas={habilidadesSel} onToggle={toggleHabilidad} />
      </div>
    </Seccion>
  );

  const seccionDisponibilidad = (
    <Seccion icon={<CalendarCheck size={16} />} titulo="Disponibilidad">
      <Campo label="Estado del centro" error={errores.estado} span>
        <Select value={form.estado} onChange={(v) => set("estado", v as EstadoCentroDual)} ariaLabel="Estado del centro"
          opciones={ESTADOS_CENTRO} />
      </Campo>
      <p style={{ color: "var(--text-muted)" }} className="sm:col-span-2 text-xs -mt-2">
        Un centro Inactivo o En revisión no aparece entre los centros recomendados en una nueva asignación. Puede seguir viéndose en el historial.
      </p>

      {(especialidadesSel.length > 0 || form.capacidad.trim()) && (
        <div className="sm:col-span-2 rounded-xl p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          {especialidadesSel.length > 0 && (
            <p style={{ color: "var(--text-secondary)" }} className="text-xs">
              <span style={{ color: "var(--text-muted)" }}>Especialidades: </span>
              {especialidadesSel.map((id) => especialidadNombre(id)).join(", ")}
            </p>
          )}
          {form.capacidad.trim() && (
            <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1">
              <span style={{ color: "var(--text-muted)" }}>Capacidad: </span>{form.capacidad} estudiante(s)
            </p>
          )}
        </div>
      )}
    </Seccion>
  );

  const resumen = (
    <div className="flex flex-col gap-4">
      {[
        {
          titulo: "Información general",
          filas: [
            ["Nombre", form.nombre || "—"],
            ["RUT", form.rut || "No registrado"],
            ["Tipo", TIPOS_CENTRO.find((t) => t.value === form.tipo)?.label || "—"],
          ],
        },
        {
          titulo: "Ubicación",
          filas: [
            ["Dirección", form.direccion || "—"],
            ["Comuna", form.comuna || "—"],
            ["Región", form.region || "—"],
          ],
        },
        {
          titulo: "Formación dual",
          filas: [
            ["Especialidades", especialidadesSel.length ? especialidadesSel.map((id) => especialidadNombre(id)).join(", ") : "Ninguna seleccionada"],
            ["Áreas de desempeño", areasSel.length ? areasSel.join(", ") : "Ninguna seleccionada"],
          ],
        },
        {
          titulo: "Capacidad",
          filas: [["Capacidad total", form.capacidad.trim() ? `${form.capacidad} estudiante(s)` : "Sin límite definido"]],
        },
        {
          titulo: "Características",
          filas: [["Seleccionadas", caracteristicasSel.length ? caracteristicasSel.join(", ") : "Ninguna seleccionada"]],
        },
        {
          titulo: "Habilidades",
          filas: [["Valoradas", habilidadesSel.length ? habilidadesSel.join(", ") : "Ninguna seleccionada"]],
        },
        {
          titulo: "Contacto",
          filas: [
            ["Nombre", form.contactoNombre || "No registrado"],
            ["Cargo", form.contactoCargo || "No registrado"],
            ["Correo", form.contactoEmail || "No registrado"],
            ["Teléfono", form.contactoTelefono || "No registrado"],
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

  // --- Modo editar: formulario plano con todas las secciones ---
  if (modo === "editar") {
    return (
      <form onSubmit={intentarGuardarEditar} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8">
        {formularioInvalido && (
          <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
            <p style={{ color: "var(--danger)" }} className="text-sm font-medium">Revisa los campos marcados en rojo antes de continuar.</p>
          </div>
        )}
        {seccionInformacionGeneral}
        {seccionUbicacionContacto}
        {seccionFormacionDual}
        {seccionCaracteristicasHabilidades}
        {seccionDisponibilidad}
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

  // --- Modo crear: asistente de 6 pasos ---
  const PASOS = ["Información general", "Ubicación y contacto", "Formación dual", "Características", "Disponibilidad", "Revisión"];

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
        {paso === 1 && seccionInformacionGeneral}
        {paso === 2 && seccionUbicacionContacto}
        {paso === 3 && seccionFormacionDual}
        {paso === 4 && seccionCaracteristicasHabilidades}
        {paso === 5 && seccionDisponibilidad}
        {paso === 6 && (
          <div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Revisar centro dual</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-5">Revisa la información antes de crear el centro.</p>
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
            {paso === 1 ? "Cancelar" : paso === 6 ? "Volver y editar" : "Volver"}
          </button>
          {paso < 6 ? (
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
              {guardando ? "Creando..." : "Crear centro dual"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
