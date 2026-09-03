"use client";
import { useMemo, useState } from "react";
import {
  Building2, UserRound, Phone, GraduationCap, CalendarCheck, CheckCircle2,
  ArrowLeft, ArrowRight, Search,
} from "lucide-react";
import { formatearRut, normalizarRut, validarRut, validarEmail, validarTelefonoChileno } from "@/lib/rut";
import { AREAS_DESEMPENO } from "@/lib/caracteristicas";
import type { CentroDual, Especialidad, EstadoMaestroGuia } from "@/types";

function normalizar(texto?: string): string {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function soloAlfanumerico(texto?: string): string {
  return (texto || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ESTADOS_MG: { value: EstadoMaestroGuia; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

export interface MaestroGuiaFormValues {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  run: string;
  email: string;
  telefono: string;
  cargo: string;
  area: string;
  aniosExperiencia: string;
  capacidad: string;
  estado: EstadoMaestroGuia;
  observaciones: string;
}

export const MAESTRO_GUIA_FORM_VACIO: MaestroGuiaFormValues = {
  nombres: "", apellidoPaterno: "", apellidoMaterno: "", run: "",
  email: "", telefono: "", cargo: "", area: "", aniosExperiencia: "",
  capacidad: "", estado: "activo", observaciones: "",
};

type Errores = Partial<Record<keyof MaestroGuiaFormValues, string>>;

function Seccion({
  icon, titulo, subtitulo, children,
}: { icon: React.ReactNode; titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: "var(--accent-light)" }}>{icon}</span>
        <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{titulo}</h3>
      </div>
      {subtitulo && <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">{subtitulo}</p>}
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

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors disabled:opacity-50";

interface MaestroGuiaFormProps {
  modo: "crear" | "editar";
  valoresIniciales: MaestroGuiaFormValues;
  centrosDisponibles: CentroDual[];
  centroFijo?: CentroDual;
  especialidadesIniciales: string[];
  areasIniciales: string[];
  especialidadesDisponibles: Especialidad[];
  rutsOcupadosPorCentro: { run: string; centroDualId: string }[];
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (
    valores: MaestroGuiaFormValues,
    centroDualId: string,
    especialidades: string[],
    areas: string[]
  ) => void | Promise<void>;
}

export default function MaestroGuiaForm({
  modo, valoresIniciales, centrosDisponibles, centroFijo, especialidadesIniciales, areasIniciales,
  especialidadesDisponibles, rutsOcupadosPorCentro, guardando, onCancelar, onGuardar,
}: MaestroGuiaFormProps) {
  const [form, setForm] = useState<MaestroGuiaFormValues>(valoresIniciales);
  const [especialidadesSel, setEspecialidadesSel] = useState<string[]>(especialidadesIniciales);
  const [areasSel, setAreasSel] = useState<string[]>(areasIniciales);
  const [errores, setErrores] = useState<Errores>({});
  const [paso, setPaso] = useState(1);
  const [formularioInvalido, setFormularioInvalido] = useState(false);

  const [busquedaCentro, setBusquedaCentro] = useState("");
  const [centroSeleccionadoId, setCentroSeleccionadoId] = useState<string | null>(centroFijo?.id ?? null);

  const centroSeleccionado = useMemo(
    () => centroFijo ?? centrosDisponibles.find((c) => c.id === centroSeleccionadoId) ?? null,
    [centroFijo, centrosDisponibles, centroSeleccionadoId]
  );

  function especialidadNombreDelCentro(id: string): string {
    return especialidadesDisponibles.find((e) => e.id === id)?.nombre || id;
  }

  const centrosFiltrados = useMemo(() => {
    if (!busquedaCentro.trim()) return centrosDisponibles;
    const q = normalizar(busquedaCentro);
    const qAlfanum = soloAlfanumerico(busquedaCentro);
    return centrosDisponibles.filter((c) => {
      const coincideNombre = normalizar(c.nombre).includes(q);
      const coincideComuna = normalizar(c.comuna).includes(q);
      const coincideRut = qAlfanum.length > 0 && soloAlfanumerico(c.rut).includes(qAlfanum);
      return coincideNombre || coincideComuna || coincideRut;
    });
  }, [centrosDisponibles, busquedaCentro]);

  function set<K extends keyof MaestroGuiaFormValues>(key: K, value: MaestroGuiaFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errores[key]) setErrores((e) => ({ ...e, [key]: undefined }));
  }

  function toggleEspecialidad(id: string) {
    setEspecialidadesSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleArea(a: string) {
    setAreasSel((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function validarPaso2(): Errores {
    const errs: Errores = {};
    if (!form.nombres.trim()) errs.nombres = "El nombre es obligatorio.";
    if (!form.apellidoPaterno.trim()) errs.apellidoPaterno = "El apellido paterno es obligatorio.";
    if (!form.run.trim()) errs.run = "El RUT es obligatorio.";
    else if (!validarRut(form.run)) errs.run = "RUT inválido. Verifica el dígito verificador.";
    else if (centroSeleccionado && rutsOcupadosPorCentro.some((r) => r.centroDualId === centroSeleccionado.id && r.run === normalizarRut(form.run))) {
      errs.run = "Este maestro guía ya está registrado en este centro.";
    }
    return errs;
  }

  function validarPaso3(): Errores {
    const errs: Errores = {};
    if (!form.email.trim()) errs.email = "El correo electrónico es obligatorio.";
    else if (!validarEmail(form.email)) errs.email = "Correo electrónico inválido.";
    if (!form.telefono.trim()) errs.telefono = "El teléfono es obligatorio.";
    else if (!validarTelefonoChileno(form.telefono)) errs.telefono = "Teléfono inválido. Usa formato chileno, ej: +56 9 1234 5678.";
    if (!form.cargo.trim()) errs.cargo = "El cargo es obligatorio.";
    if (form.aniosExperiencia.trim()) {
      const n = Number(form.aniosExperiencia);
      if (!Number.isInteger(n) || n < 0) errs.aniosExperiencia = "Los años de experiencia no pueden ser negativos.";
    }
    return errs;
  }

  function validarPaso5(): Errores {
    const errs: Errores = {};
    if (form.capacidad.trim()) {
      const n = Number(form.capacidad);
      if (!Number.isInteger(n) || n < 0) errs.capacidad = "La capacidad no puede ser negativa.";
    }
    return errs;
  }

  function irAlPrimerError() {
    setFormularioInvalido(true);
    const primerCampoConError = document.querySelector('[data-error="true"]');
    primerCampoConError?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function intentarAvanzar() {
    if (paso === 1) {
      if (!centroSeleccionadoId) return;
      setPaso(2);
      return;
    }
    let errs: Errores = {};
    if (paso === 2) errs = validarPaso2();
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
    if (!centroSeleccionado) return;
    onGuardar(form, centroSeleccionado.id, especialidadesSel, areasSel);
  }

  function intentarGuardarEditar(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errores = { ...validarPaso2(), ...validarPaso3(), ...validarPaso5() };
    setErrores(errs);
    if (Object.keys(errs).length > 0) {
      irAlPrimerError();
      return;
    }
    setFormularioInvalido(false);
    guardarFinal();
  }

  const seccionCentroContexto = centroSeleccionado && (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 mb-2">
      <p style={{ color: "var(--text-muted)" }} className="text-xs mb-0.5">Centro dual</p>
      <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{centroSeleccionado.nombre}</p>
      <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1">
        <span style={{ color: "var(--text-muted)" }}>Ubicación: </span>
        {[centroSeleccionado.comuna, centroSeleccionado.ciudad].filter(Boolean).join(", ") || "—"}
      </p>
      <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">
        <span style={{ color: "var(--text-muted)" }}>Especialidades: </span>
        {centroSeleccionado.especialidades.length > 0 ? centroSeleccionado.especialidades.map((id) => especialidadNombreDelCentro(id)).join(" · ") : "Sin especialidades registradas"}
      </p>
    </div>
  );

  const seccionInformacionPersonal = (
    <Seccion icon={<UserRound size={16} />} titulo="Información personal">
      <Campo label="Nombres *" error={errores.nombres}>
        <input value={form.nombres} onChange={(e) => set("nombres", e.target.value)} placeholder="Juan Andrés" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Apellido paterno *" error={errores.apellidoPaterno}>
        <input value={form.apellidoPaterno} onChange={(e) => set("apellidoPaterno", e.target.value)} placeholder="Pérez" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Apellido materno (opcional)" error={errores.apellidoMaterno}>
        <input value={form.apellidoMaterno} onChange={(e) => set("apellidoMaterno", e.target.value)} placeholder="González" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="RUT *" error={errores.run}>
        <input value={form.run} onChange={(e) => set("run", formatearRut(e.target.value))} placeholder="12.345.678-9" style={inputStyle} className={inputClass} />
      </Campo>
    </Seccion>
  );

  const seccionContactoCargo = (
    <Seccion icon={<Phone size={16} />} titulo="Contacto y cargo">
      <Campo label="Correo electrónico *" error={errores.email}>
        <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="correo@empresa.cl" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Teléfono *" error={errores.telefono}>
        <input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Cargo *" error={errores.cargo}>
        <input value={form.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Encargado de administración" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Área o departamento (opcional)" error={errores.area}>
        <input value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="Administración" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Años de experiencia (opcional)" error={errores.aniosExperiencia}>
        <input type="number" min={0} value={form.aniosExperiencia} onChange={(e) => set("aniosExperiencia", e.target.value)} style={inputStyle} className={inputClass} />
      </Campo>
    </Seccion>
  );

  const seccionEspecialidadesAreas = (
    <Seccion icon={<GraduationCap size={16} />} titulo="Especialidades y áreas">
      <div className="sm:col-span-2">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-1">Especialidades que puede guiar</p>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mb-3">No significa que deba dedicarse a una sola — puede guiar varias.</p>
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
      </div>
      <div className="sm:col-span-2 mt-4">
        <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium mb-1">Áreas o funciones que puede supervisar</p>
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
    </Seccion>
  );

  const seccionCapacidadEstado = (
    <Seccion icon={<CalendarCheck size={16} />} titulo="Capacidad, estado y observaciones">
      <Campo label="Máximo de estudiantes que puede acompañar (opcional)" error={errores.capacidad}>
        <input type="number" min={0} value={form.capacidad} onChange={(e) => set("capacidad", e.target.value)} placeholder="Sin límite si se deja vacío" style={inputStyle} className={inputClass} />
      </Campo>
      <Campo label="Estado" error={errores.estado}>
        <select value={form.estado} onChange={(e) => set("estado", e.target.value as EstadoMaestroGuia)} style={inputStyle} className={inputClass}>
          {ESTADOS_MG.map((es) => <option key={es.value} value={es.value}>{es.label}</option>)}
        </select>
      </Campo>
      <Campo label="Observaciones (opcional)" error={errores.observaciones} span>
        <textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={3} placeholder="Información adicional que no tenga un campo propio..." style={inputStyle} className={`${inputClass} resize-none`} />
      </Campo>
    </Seccion>
  );

  const resumen = centroSeleccionado && (
    <div className="flex flex-col gap-4">
      {[
        { titulo: "Centro dual", filas: [["Centro", centroSeleccionado.nombre]] },
        {
          titulo: "Información personal",
          filas: [
            ["Nombre", `${form.nombres} ${form.apellidoPaterno} ${form.apellidoMaterno}`.trim() || "—"],
            ["RUT", form.run || "—"],
          ],
        },
        {
          titulo: "Contacto y cargo",
          filas: [
            ["Cargo", form.cargo || "—"],
            ["Área", form.area || "No registrada"],
            ["Correo", form.email || "—"],
            ["Teléfono", form.telefono || "—"],
          ],
        },
        {
          titulo: "Especialidades y áreas",
          filas: [
            ["Especialidades", especialidadesSel.length ? especialidadesSel.map((id) => especialidadNombreDelCentro(id)).join(", ") : "Ninguna seleccionada"],
            ["Áreas", areasSel.length ? areasSel.join(", ") : "Ninguna seleccionada"],
          ],
        },
        {
          titulo: "Capacidad y estado",
          filas: [
            ["Capacidad", form.capacidad.trim() ? `${form.capacidad} estudiante(s)` : "Sin límite definido"],
            ["Estado", ESTADOS_MG.find((e) => e.value === form.estado)?.label || "—"],
          ],
        },
        { titulo: "Observaciones", filas: [["Notas", form.observaciones.trim() || "Sin observaciones"]] },
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

  // --- Modo editar: formulario plano, centro fijo de solo lectura ---
  if (modo === "editar") {
    return (
      <form onSubmit={intentarGuardarEditar} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8">
        {formularioInvalido && (
          <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
            <p style={{ color: "var(--danger)" }} className="text-sm font-medium">Revisa los campos marcados en rojo antes de continuar.</p>
          </div>
        )}
        {seccionCentroContexto}
        {seccionInformacionPersonal}
        {seccionContactoCargo}
        {seccionEspecialidadesAreas}
        {seccionCapacidadEstado}
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
  const PASOS = ["Centro dual", "Información personal", "Contacto y cargo", "Especialidades", "Capacidad y estado", "Revisión"];

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
        {paso === 1 && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} style={{ color: "var(--accent-light)" }} />
              <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Centro dual</h3>
            </div>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Selecciona el centro dual al que pertenece este maestro guía.</p>

            <div className="relative mb-4">
              <Search size={16} style={{ color: "var(--text-muted)" }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={busquedaCentro}
                onChange={(e) => setBusquedaCentro(e.target.value)}
                placeholder="Buscar por nombre, RUT o comuna..."
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none focus:[border-color:var(--accent)] transition-colors"
              />
            </div>

            <div className="max-h-72 overflow-y-auto flex flex-col gap-2">
              {centrosFiltrados.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }} className="text-sm text-center py-6">No encontramos centros con ese criterio.</p>
              ) : centrosFiltrados.map((c) => {
                const seleccionado = c.id === centroSeleccionadoId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCentroSeleccionadoId(c.id)}
                    style={{
                      background: seleccionado ? "var(--accent)" : "var(--bg-surface)",
                      border: `1px solid ${seleccionado ? "var(--accent)" : "var(--border)"}`,
                    }}
                    className="flex flex-col items-start px-4 py-3 rounded-xl text-left transition-colors"
                  >
                    <span style={{ color: seleccionado ? "var(--text-on-accent)" : "var(--text-primary)" }} className="text-sm font-semibold">{c.nombre}</span>
                    <span style={{ color: seleccionado ? "var(--text-on-accent)" : "var(--text-muted)", opacity: seleccionado ? 0.8 : 1 }} className="text-xs mt-0.5">
                      {c.comuna}{c.rut ? ` · ${c.rut}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {seccionCentroContexto && <div className="mt-4">{seccionCentroContexto}</div>}
          </div>
        )}
        {paso === 2 && seccionInformacionPersonal}
        {paso === 3 && seccionContactoCargo}
        {paso === 4 && seccionEspecialidadesAreas}
        {paso === 5 && seccionCapacidadEstado}
        {paso === 6 && (
          <div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Revisar maestro guía</h2>
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
            {paso === 1 ? "Cancelar" : paso === 6 ? "Volver y editar" : "Volver"}
          </button>
          {paso < 6 ? (
            <button
              type="button"
              onClick={intentarAvanzar}
              disabled={paso === 1 && !centroSeleccionadoId}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
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
              {guardando ? "Creando..." : "Crear maestro guía"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
