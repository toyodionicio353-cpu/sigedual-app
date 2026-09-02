"use client";
import { useState } from "react";
import {
  Building2, UserCog, Phone, Globe2, GraduationCap,
  Settings, Plus, X, RotateCcw,
} from "lucide-react";
import { validarEmail, validarTelefonoChileno, validarRut, formatearRut } from "@/lib/rut";

export const REGIONES = [
  "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo",
  "Valparaíso", "Metropolitana de Santiago", "Libertador Gral. Bernardo O'Higgins",
  "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos",
  "Aysén del Gral. Carlos Ibáñez del Campo", "Magallanes y de la Antártica Chilena",
];

const TIPOS_ESTABLECIMIENTO = ["Liceo", "Colegio", "Instituto", "Centro de Formación Técnica", "Otro"];
const DEPENDENCIAS = [
  "Municipal", "Servicio Local de Educación", "Particular subvencionado",
  "Particular pagado", "Corporación de administración delegada",
];
const CARGOS_SUGERIDOS = ["Director/a", "Subdirector/a", "Coordinador/a Dual", "Jefe/a de UTP", "Encargado/a de Convivencia"];

export interface LiceoFormValues {
  nombre: string;
  nombreCorto: string;
  rut: string;
  tipoEstablecimiento: string;
  dependencia: string;
  rbd: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  region: string;
  responsableNombre: string;
  responsableCargo: string;
  responsableRun: string;
  responsableTelefono: string;
  responsableEmail: string;
  telefono: string;
  email: string;
  sitioWeb: string;
  dominioCorreo: string;
  estado: "activo" | "inactivo";
}

export interface EspecialidadForm {
  key: string;
  docId?: string;
  nombre: string;
  estado: "activa" | "inactiva";
}

export const LICEO_FORM_VACIO: LiceoFormValues = {
  nombre: "", nombreCorto: "", rut: "", tipoEstablecimiento: "", dependencia: "", rbd: "",
  direccion: "", comuna: "", ciudad: "", region: "",
  responsableNombre: "", responsableCargo: "", responsableRun: "", responsableTelefono: "", responsableEmail: "",
  telefono: "", email: "", sitioWeb: "",
  dominioCorreo: "",
  estado: "activo",
};

function dominioValido(dominio: string): boolean {
  return /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(dominio.trim());
}

function Seccion({ icon, titulo, subtitulo, children }: { icon: React.ReactNode; titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: "var(--accent-blue-light)" }}>{icon}</span>
        <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{titulo}</h3>
      </div>
      {subtitulo && <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">{subtitulo}</p>}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${subtitulo ? "" : "mt-4"}`}>{children}</div>
    </div>
  );
}

function Campo({ label, error, children, span }: { label: string; error?: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : ""} data-error={error ? "true" : "false"}>
      <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">{label}</label>
      {children}
      {error && <p style={{ color: "var(--danger)" }} className="text-xs mt-1">{error}</p>}
    </div>
  );
}

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors";

interface LiceoFormProps {
  modo: "crear" | "editar";
  valoresIniciales: LiceoFormValues;
  especialidadesIniciales: EspecialidadForm[];
  dominiosOcupados: string[];
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (valores: LiceoFormValues, especialidades: EspecialidadForm[]) => void | Promise<void>;
  onEliminarEspecialidad?: (esp: EspecialidadForm) => Promise<"eliminada" | "desactivada" | "cancelado">;
}

let contador = 0;
function nuevaClave() {
  contador += 1;
  return `nueva-${Date.now()}-${contador}`;
}

export default function LiceoForm({
  modo, valoresIniciales, especialidadesIniciales, dominiosOcupados, guardando,
  onCancelar, onGuardar, onEliminarEspecialidad,
}: LiceoFormProps) {
  const [form, setForm] = useState<LiceoFormValues>(valoresIniciales);
  const [especialidades, setEspecialidades] = useState<EspecialidadForm[]>(especialidadesIniciales);
  const [errores, setErrores] = useState<Partial<Record<keyof LiceoFormValues, string>>>({});
  const [errorEspecialidades, setErrorEspecialidades] = useState("");
  const [formularioInvalido, setFormularioInvalido] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  function set<K extends keyof LiceoFormValues>(key: K, value: LiceoFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errores[key]) setErrores((e) => ({ ...e, [key]: undefined }));
  }

  function agregarEspecialidad() {
    setEspecialidades((prev) => [...prev, { key: nuevaClave(), nombre: "", estado: "activa" }]);
    setErrorEspecialidades("");
  }

  function cambiarNombreEspecialidad(key: string, nombre: string) {
    setEspecialidades((prev) => prev.map((e) => (e.key === key ? { ...e, nombre } : e)));
  }

  async function quitarEspecialidad(esp: EspecialidadForm) {
    if (!esp.docId) {
      setEspecialidades((prev) => prev.filter((e) => e.key !== esp.key));
      return;
    }
    if (!onEliminarEspecialidad) return;
    const resultado = await onEliminarEspecialidad(esp);
    if (resultado === "eliminada") {
      setEspecialidades((prev) => prev.filter((e) => e.key !== esp.key));
    } else if (resultado === "desactivada") {
      setEspecialidades((prev) => prev.map((e) => (e.key === esp.key ? { ...e, estado: "inactiva" } : e)));
    }
  }

  function reactivarEspecialidad(key: string) {
    setEspecialidades((prev) => prev.map((e) => (e.key === key ? { ...e, estado: "activa" } : e)));
  }

  function validar(): boolean {
    const nuevosErrores: Partial<Record<keyof LiceoFormValues, string>> = {};

    if (!form.nombre.trim()) nuevosErrores.nombre = "El nombre del liceo es obligatorio.";
    if (!form.rbd.trim()) nuevosErrores.rbd = "El RBD es obligatorio.";
    if (!form.direccion.trim()) nuevosErrores.direccion = "La dirección es obligatoria.";
    if (!form.comuna.trim()) nuevosErrores.comuna = "La comuna es obligatoria.";
    if (!form.region.trim()) nuevosErrores.region = "Selecciona una región.";

    if (!form.responsableNombre.trim()) nuevosErrores.responsableNombre = "El nombre del responsable es obligatorio.";
    if (!form.responsableCargo.trim()) nuevosErrores.responsableCargo = "El cargo del responsable es obligatorio.";
    if (form.responsableRun.trim() && !validarRut(form.responsableRun)) nuevosErrores.responsableRun = "RUN inválido. Verifica el dígito verificador.";
    if (form.responsableTelefono.trim() && !validarTelefonoChileno(form.responsableTelefono)) nuevosErrores.responsableTelefono = "Teléfono inválido. Usa formato chileno, ej: +56 9 1234 5678.";
    if (form.responsableEmail.trim() && !validarEmail(form.responsableEmail)) nuevosErrores.responsableEmail = "Correo electrónico inválido.";

    if (form.telefono.trim() && !validarTelefonoChileno(form.telefono)) nuevosErrores.telefono = "Teléfono inválido. Usa formato chileno, ej: +56 9 1234 5678.";
    if (form.email.trim() && !validarEmail(form.email)) nuevosErrores.email = "Correo electrónico inválido.";

    if (!form.dominioCorreo.trim()) {
      nuevosErrores.dominioCorreo = "El dominio institucional es obligatorio.";
    } else if (!dominioValido(form.dominioCorreo)) {
      nuevosErrores.dominioCorreo = "Formato inválido. Ejemplo: liceoejemplo.cl";
    } else if (dominiosOcupados.includes(form.dominioCorreo.trim().toLowerCase())) {
      nuevosErrores.dominioCorreo = "Este dominio ya está siendo usado por otro liceo.";
    }

    const nombresEspecialidades = especialidades
      .filter((e) => e.estado === "activa")
      .map((e) => e.nombre.trim().toLowerCase())
      .filter(Boolean);
    if (especialidades.some((e) => e.estado === "activa" && !e.nombre.trim())) {
      setErrorEspecialidades("Completa el nombre de cada especialidad o elimínala.");
    } else if (new Set(nombresEspecialidades).size !== nombresEspecialidades.length) {
      setErrorEspecialidades("Hay especialidades repetidas.");
    } else {
      setErrorEspecialidades("");
    }

    setErrores(nuevosErrores);
    const especialidadesValidas = !especialidades.some((e) => e.estado === "activa" && !e.nombre.trim())
      && new Set(nombresEspecialidades).size === nombresEspecialidades.length;
    return Object.keys(nuevosErrores).length === 0 && especialidadesValidas;
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
      onGuardar(form, especialidades);
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

        <Seccion icon={<Building2 size={16} />} titulo="Información del liceo">
          <Campo label="Nombre completo del liceo" error={errores.nombre} span>
            <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Liceo Guillermo Marín Larraín" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Nombre corto / sigla" error={errores.nombreCorto}>
            <input value={form.nombreCorto} onChange={(e) => set("nombreCorto", e.target.value)} placeholder="LGML" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="RBD" error={errores.rbd}>
            <input value={form.rbd} onChange={(e) => set("rbd", e.target.value)} placeholder="12345-6" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="RUT del establecimiento" error={errores.rut}>
            <input value={form.rut} onChange={(e) => set("rut", formatearRut(e.target.value))} placeholder="65.123.456-7" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Tipo de establecimiento" error={errores.tipoEstablecimiento}>
            <select value={form.tipoEstablecimiento} onChange={(e) => set("tipoEstablecimiento", e.target.value)} style={inputStyle} className={inputClass}>
              <option value="">Selecciona una opción</option>
              {TIPOS_ESTABLECIMIENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Dependencia" error={errores.dependencia}>
            <select value={form.dependencia} onChange={(e) => set("dependencia", e.target.value)} style={inputStyle} className={inputClass}>
              <option value="">Selecciona una opción</option>
              {DEPENDENCIAS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
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
          <Campo label="Región" error={errores.region} span>
            <select value={form.region} onChange={(e) => set("region", e.target.value)} style={inputStyle} className={inputClass}>
              <option value="">Selecciona una región</option>
              {REGIONES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Campo>
        </Seccion>

        <Seccion icon={<UserCog size={16} />} titulo="Responsable del establecimiento">
          <Campo label="Nombre completo" error={errores.responsableNombre}>
            <input value={form.responsableNombre} onChange={(e) => set("responsableNombre", e.target.value)} placeholder="Nombre del responsable" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Cargo" error={errores.responsableCargo}>
            <input value={form.responsableCargo} onChange={(e) => set("responsableCargo", e.target.value)} placeholder="Director/a" list="cargos-sugeridos" style={inputStyle} className={inputClass} />
            <datalist id="cargos-sugeridos">
              {CARGOS_SUGERIDOS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Campo>
          <Campo label="RUN" error={errores.responsableRun}>
            <input value={form.responsableRun} onChange={(e) => set("responsableRun", formatearRut(e.target.value))} placeholder="12.345.678-9" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Teléfono" error={errores.responsableTelefono}>
            <input value={form.responsableTelefono} onChange={(e) => set("responsableTelefono", e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Correo electrónico" error={errores.responsableEmail} span>
            <input type="email" value={form.responsableEmail} onChange={(e) => set("responsableEmail", e.target.value)} placeholder="responsable@liceo.cl" style={inputStyle} className={inputClass} />
          </Campo>
        </Seccion>

        <Seccion icon={<Phone size={16} />} titulo="Información de contacto">
          <Campo label="Teléfono institucional" error={errores.telefono}>
            <input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Correo institucional" error={errores.email}>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contacto@liceo.cl" style={inputStyle} className={inputClass} />
          </Campo>
          <Campo label="Sitio web" error={errores.sitioWeb} span>
            <input value={form.sitioWeb} onChange={(e) => set("sitioWeb", e.target.value)} placeholder="www.liceo.cl" style={inputStyle} className={inputClass} />
          </Campo>
        </Seccion>

        <Seccion
          icon={<Globe2 size={16} />}
          titulo="Dominio institucional"
          subtitulo="El dominio institucional será utilizado para identificar y gestionar las cuentas pertenecientes a este liceo."
        >
          <Campo label="Dominio" error={errores.dominioCorreo} span>
            <div className="relative">
              <span style={{ color: "var(--text-muted)" }} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">@</span>
              <input
                value={form.dominioCorreo}
                onChange={(e) => set("dominioCorreo", e.target.value.trim().toLowerCase())}
                placeholder="liceoejemplo.cl"
                style={inputStyle}
                className={`${inputClass} pl-7`}
              />
            </div>
          </Campo>
        </Seccion>

        <Seccion icon={<GraduationCap size={16} />} titulo="Especialidades">
          <div className="sm:col-span-2 flex flex-col gap-3">
            {especialidades.map((esp, i) => (
              <div key={esp.key}>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad {i + 1}</label>
                <div className="flex gap-2 items-center">
                  <input
                    value={esp.nombre}
                    onChange={(e) => cambiarNombreEspecialidad(esp.key, e.target.value)}
                    disabled={esp.estado === "inactiva"}
                    placeholder="Ej: Contabilidad"
                    style={inputStyle}
                    className={`${inputClass} disabled:opacity-50`}
                  />
                  {esp.estado === "inactiva" ? (
                    <button
                      type="button"
                      onClick={() => reactivarEspecialidad(esp.key)}
                      title="Reactivar"
                      style={{ color: "var(--accent-blue-light)" }}
                      className="p-2 flex-shrink-0"
                    >
                      <RotateCcw size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => quitarEspecialidad(esp)}
                      title="Eliminar"
                      style={{ color: "var(--danger)" }}
                      className="p-2 flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {esp.estado === "inactiva" && (
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">Inactiva (en uso por estudiantes registrados). No aparecerá como opción para nuevos registros.</p>
                )}
              </div>
            ))}
            {errorEspecialidades && <p style={{ color: "var(--danger)" }} className="text-xs">{errorEspecialidades}</p>}
            <button
              type="button"
              onClick={agregarEspecialidad}
              style={{ color: "var(--accent-blue-light)" }}
              className="flex items-center gap-1.5 text-sm font-medium hover:underline self-start"
            >
              <Plus size={15} />
              Agregar especialidad
            </button>
          </div>
        </Seccion>

        <Seccion icon={<Settings size={16} />} titulo="Configuración del liceo">
          <Campo label="Estado del liceo" error={errores.estado}>
            <select value={form.estado} onChange={(e) => set("estado", e.target.value as LiceoFormValues["estado"])} style={inputStyle} className={inputClass}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </Campo>
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
            {guardando ? "Guardando..." : modo === "crear" ? "Guardar liceo" : "Guardar cambios"}
          </button>
        </div>
      </form>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Registrar este liceo?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
              Se creará un nuevo establecimiento en SIGEDUAL con la información ingresada.
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
                onClick={() => onGuardar(form, especialidades)}
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
