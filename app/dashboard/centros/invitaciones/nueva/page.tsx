"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { validarEmail, validarTelefonoChileno } from "@/lib/rut";
import Select from "@/components/ui/Select";
import TituloPagina from "@/components/TituloPagina";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import type { Especialidad, InvitacionEmpresa } from "@/types";
import { Send, Copy, CheckCircle2, ArrowLeft } from "lucide-react";

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors disabled:opacity-50";

const DIAS_EXPIRACION = 30;

interface FormValues {
  especialidadId: string;
  cursos: string;
  nombrePreliminar: string;
  contactoNombre: string;
  contactoEmail: string;
  contactoTelefono: string;
  observaciones: string;
}

const FORM_VACIO: FormValues = {
  especialidadId: "", cursos: "", nombrePreliminar: "",
  contactoNombre: "", contactoEmail: "", contactoTelefono: "", observaciones: "",
};

export default function GenerarInvitacionPage() {
  const { usuario } = useAuth();
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();

  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [form, setForm] = useState<FormValues>(FORM_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [enlaceGenerado, setEnlaceGenerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setCargandoDatos(true);
      const snap = await getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId)));
      setEspecialidades(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setCargandoDatos(false);
    }
    cargar();
  }, [usuario]);

  function set<K extends keyof FormValues>(campo: K, valor: FormValues[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function validar(): boolean {
    const nuevos: Partial<Record<keyof FormValues, string>> = {};
    if (form.contactoEmail.trim() && !validarEmail(form.contactoEmail.trim())) nuevos.contactoEmail = "Correo inválido.";
    if (form.contactoTelefono.trim() && !validarTelefonoChileno(form.contactoTelefono.trim())) nuevos.contactoTelefono = "Teléfono inválido.";
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  async function generar() {
    if (!usuario || guardando) return;
    if (!validar()) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const id = crypto.randomUUID();
      const ahora = new Date();
      const expira = new Date(ahora.getTime() + DIAS_EXPIRACION * 24 * 60 * 60 * 1000);
      const especialidadSel = especialidades.find((e) => e.id === form.especialidadId);
      const nueva: Omit<InvitacionEmpresa, "id"> = {
        liceoId: usuario.liceoId,
        profesorUid: usuario.uid,
        profesorNombre: usuario.nombre,
        estado: "generado",
        creadoEn: ahora.toISOString(),
        expiraEn: expira.toISOString(),
        ...(especialidadSel ? { especialidadId: especialidadSel.id } : {}),
        ...(form.cursos.trim() ? { cursos: form.cursos.split(",").map((c) => c.trim()).filter(Boolean) } : {}),
        ...(form.nombrePreliminar.trim() ? { nombrePreliminar: form.nombrePreliminar.trim() } : {}),
        ...(form.contactoNombre.trim() ? { contactoNombre: form.contactoNombre.trim() } : {}),
        ...(form.contactoEmail.trim() ? { contactoEmail: form.contactoEmail.trim() } : {}),
        ...(form.contactoTelefono.trim() ? { contactoTelefono: form.contactoTelefono.trim() } : {}),
        ...(form.observaciones.trim() ? { observaciones: form.observaciones.trim() } : {}),
      };
      await setDoc(doc(db, "invitaciones", id), nueva);
      setEnlaceGenerado(`${window.location.origin}/invitacion/${id}`);
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible generar la invitación. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  async function copiarEnlace() {
    if (!enlaceGenerado) return;
    try {
      await navigator.clipboard.writeText(enlaceGenerado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // portapapeles no disponible; el enlace ya está visible para copiar manualmente
    }
  }

  if (enlaceGenerado) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-8 text-center">
          <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
          </div>
          <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Invitación generada correctamente.</h2>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">
            Comparte este enlace con la empresa dual. Es válido por {DIAS_EXPIRACION} días y solo puede usarse a través de este vínculo — no lo publiques en canales abiertos.
          </p>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <code style={{ color: "var(--text-primary)" }} className="text-xs flex-1 truncate text-left">{enlaceGenerado}</code>
            <button
              onClick={copiarEnlace}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-shrink-0"
            >
              <Copy size={13} />
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard/centros/invitaciones"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            >
              Ver formularios recibidos
            </Link>
            <button
              onClick={() => { setEnlaceGenerado(null); setForm(FORM_VACIO); }}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            >
              Generar otra
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <TituloPagina icon={<Send size={28} />}>Generar formulario para Empresa Dual</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Genera un enlace único y seguro para que una empresa complete sus datos, perfil y Maestros Guía sin necesitar una cuenta en SIGEDUAL.
        </p>
      </div>

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {!cargandoDatos && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="rounded-2xl p-6">
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">
            Estos datos son solo referenciales para tu propio seguimiento — no se muestran a la empresa ni condicionan lo que puede responder en el formulario.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Especialidad relacionada (opcional)</label>
              <Select
                value={form.especialidadId}
                onChange={(v) => set("especialidadId", v)}
                ariaLabel="Especialidad relacionada"
                placeholder="Sin especialidad definida"
                opciones={especialidades.map((e) => ({ value: e.id, label: e.nombre }))}
              />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Cursos relacionados (opcional)</label>
              <input value={form.cursos} onChange={(e) => set("cursos", e.target.value)} placeholder="3ºA, 4ºB" style={inputStyle} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nombre preliminar de la empresa (opcional)</label>
              <input value={form.nombrePreliminar} onChange={(e) => set("nombrePreliminar", e.target.value)} placeholder="Nombre con el que conoces a la empresa" style={inputStyle} className={inputClass} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nombre de contacto (opcional)</label>
              <input value={form.contactoNombre} onChange={(e) => set("contactoNombre", e.target.value)} style={inputStyle} className={inputClass} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Correo de contacto (opcional)</label>
              <input value={form.contactoEmail} onChange={(e) => set("contactoEmail", e.target.value)} style={inputStyle} className={inputClass} />
              {errores.contactoEmail && <p style={{ color: "var(--danger)" }} className="text-xs mt-1">{errores.contactoEmail}</p>}
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Teléfono de contacto (opcional)</label>
              <input value={form.contactoTelefono} onChange={(e) => set("contactoTelefono", e.target.value)} style={inputStyle} className={inputClass} />
              {errores.contactoTelefono && <p style={{ color: "var(--danger)" }} className="text-xs mt-1">{errores.contactoTelefono}</p>}
            </div>
            <div className="sm:col-span-2">
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Observaciones (opcional)</label>
              <textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={3} style={inputStyle} className={inputClass} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard/centros"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={15} />
              Cancelar
            </Link>
            <button
              onClick={() => conConfirmacion(generar)}
              disabled={guardando}
              style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {guardando ? "Generando..." : "Generar enlace"}
            </button>
          </div>
        </div>
      )}

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="una invitación para empresa dual" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}
    </div>
  );
}
