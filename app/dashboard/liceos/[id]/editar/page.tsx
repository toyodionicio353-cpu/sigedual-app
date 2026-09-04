"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import LiceoForm, { type LiceoFormValues, type EspecialidadForm } from "../../_components/LiceoForm";
import type { Liceo, Especialidad, CodigoAcceso } from "@/types";
import { ArrowLeft, ShieldCheck, RefreshCw, Copy, Check, Pencil } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

const HORAS_VALIDEZ = 24;

function generarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function tiempoRestante(expiraEn: string): string {
  const ms = new Date(expiraEn).getTime() - Date.now();
  if (ms <= 0) return "Expirado";
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return `${horas} horas ${minutos} minutos`;
}

export default function EditarLiceoPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const [valores, setValores] = useState<LiceoFormValues | null>(null);
  const [especialidades, setEspecialidades] = useState<EspecialidadForm[]>([]);
  const [dominiosOcupados, setDominiosOcupados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errorSistema, setErrorSistema] = useState("");

  const [codigoActual, setCodigoActual] = useState<CodigoAcceso | null>(null);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  const [confirmandoRegenerar, setConfirmandoRegenerar] = useState(false);
  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [, setTick] = useState(0);

  const puedeGestionar = usuario?.rol === "administrador";

  async function cargar() {
    if (!id) return;
    setLoading(true);
    const [snapLiceo, snapEsp, snapTodos, snapCodigo] = await Promise.all([
      getDoc(doc(db, "liceos", id)),
      getDocs(query(collection(db, "especialidades"), where("liceoId", "==", id))),
      getDocs(collection(db, "liceos")),
      getDoc(doc(db, "codigosAcceso", id)),
    ]);
    if (!snapLiceo.exists()) {
      setNoEncontrado(true);
      setLoading(false);
      return;
    }
    const l = snapLiceo.data() as Liceo;
    setValores({
      nombre: l.nombre ?? "", nombreCorto: l.nombreCorto ?? "", rut: l.rut ?? "",
      tipoEstablecimiento: l.tipoEstablecimiento ?? "", dependencia: l.dependencia ?? "",
      rbd: l.rbd ?? "", direccion: l.direccion ?? "", comuna: l.comuna ?? "",
      ciudad: l.ciudad ?? "", region: l.region ?? "",
      responsableNombre: l.responsableNombre ?? "", responsableCargo: l.responsableCargo ?? "",
      responsableRun: l.responsableRun ?? "", responsableTelefono: l.responsableTelefono ?? "",
      responsableEmail: l.responsableEmail ?? "",
      telefono: l.telefono ?? "", email: l.email ?? "", sitioWeb: l.sitioWeb ?? "",
      dominioCorreo: l.dominioCorreo ?? "",
      estado: l.estado ?? "activo",
    });
    setEspecialidades(
      snapEsp.docs.map((d) => {
        const esp = d.data() as Especialidad;
        return { key: d.id, docId: d.id, nombre: esp.nombre, estado: esp.estado ?? "activa" };
      })
    );
    setDominiosOcupados(
      snapTodos.docs
        .filter((d) => d.id !== id)
        .map((d) => (d.data().dominioCorreo as string | undefined)?.toLowerCase())
        .filter(Boolean) as string[]
    );
    setCodigoActual(snapCodigo.exists() ? (snapCodigo.data() as CodigoAcceso) : null);
    setLoading(false);
  }

  useEffect(() => {
    if (usuario && id) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  async function guardar(nuevosValores: LiceoFormValues, nuevasEspecialidades: EspecialidadForm[]) {
    if (!usuario || !id || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    setMensaje("");
    try {
      await updateDoc(doc(db, "liceos", id), {
        ...nuevosValores,
        dominioCorreo: nuevosValores.dominioCorreo.trim().toLowerCase(),
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: usuario.uid,
      });

      for (const esp of nuevasEspecialidades) {
        if (esp.docId) {
          const original = especialidades.find((e) => e.docId === esp.docId);
          if (original && (original.nombre !== esp.nombre || original.estado !== esp.estado)) {
            await updateDoc(doc(db, "especialidades", esp.docId), { nombre: esp.nombre.trim(), estado: esp.estado });
          }
        } else if (esp.estado === "activa" && esp.nombre.trim()) {
          await addDoc(collection(db, "especialidades"), { nombre: esp.nombre.trim(), liceoId: id, estado: "activa" });
        }
      }

      setMensaje("Cambios guardados correctamente.");
      await cargar();
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No se pudieron guardar los cambios. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarEspecialidad(esp: EspecialidadForm): Promise<"eliminada" | "desactivada" | "cancelado"> {
    if (!esp.docId) return "cancelado";
    const snap = await getDocs(query(collection(db, "estudiantes"), where("especialidadId", "==", esp.docId)));
    if (snap.size > 0) {
      const ok = confirm(
        `Esta especialidad está siendo usada por ${snap.size} estudiante(s) registrado(s). No se eliminará: solo se marcará como inactiva y dejará de aparecer para nuevos registros. ¿Continuar?`
      );
      if (!ok) return "cancelado";
      await updateDoc(doc(db, "especialidades", esp.docId), { estado: "inactiva" });
      return "desactivada";
    }
    const ok = confirm("¿Eliminar esta especialidad? No está siendo usada por ningún estudiante.");
    if (!ok) return "cancelado";
    await deleteDoc(doc(db, "especialidades", esp.docId));
    return "eliminada";
  }

  async function confirmarRegenerar() {
    if (!usuario || !id) return;
    setGenerandoCodigo(true);
    try {
      const nuevo: CodigoAcceso = {
        liceoId: id,
        codigo: generarCodigo(),
        generadoPor: usuario.uid,
        expiraEn: new Date(Date.now() + HORAS_VALIDEZ * 60 * 60 * 1000).toISOString(),
        actualizadoEn: new Date().toISOString(),
      };
      await setDoc(doc(db, "codigosAcceso", id), nuevo);
      setCodigoActual(nuevo);
      setMostrarCodigo(true);
    } finally {
      setGenerandoCodigo(false);
      setConfirmandoRegenerar(false);
    }
  }

  function copiarCodigo() {
    if (!codigoActual) return;
    navigator.clipboard.writeText(codigoActual.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  if (usuario && !puedeGestionar) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  if (loading || !valores) {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (noEncontrado) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Liceo no encontrado</p>
          <Link href="/dashboard/liceos" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  const expirado = codigoActual ? new Date(codigoActual.expiraEn).getTime() < Date.now() : true;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<Pencil size={28} />}>Editar liceo</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Actualiza la información del establecimiento.</p>
        </div>
        <Link
          href={`/dashboard/liceos/${id}`}
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver a la ficha
        </Link>
      </div>

      {mensaje && (
        <div style={{ background: "var(--success)22", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--success)" }} className="text-sm font-medium">{mensaje}</p>
        </div>
      )}
      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      <LiceoForm
        modo="editar"
        valoresIniciales={valores}
        especialidadesIniciales={especialidades}
        dominiosOcupados={dominiosOcupados}
        guardando={guardando}
        onCancelar={() => router.push(`/dashboard/liceos/${id}`)}
        onGuardar={guardar}
        onEliminarEspecialidad={eliminarEspecialidad}
      />

      {/* Código de seguridad */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-5 sm:p-8 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} style={{ color: "var(--accent-light)" }} />
          <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">Código de seguridad</h3>
        </div>
        <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">
          Se utiliza para la creación de cuentas de este liceo. Código válido durante {HORAS_VALIDEZ} horas.
        </p>

        {!codigoActual ? (
          <>
            <p style={{ color: "var(--text-muted)" }} className="text-sm mb-4">No generado.</p>
            <button
              onClick={confirmarRegenerar}
              disabled={generandoCodigo}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={generandoCodigo ? "animate-spin" : ""} />
              Generar código de seguridad
            </button>
          </>
        ) : expirado ? (
          <>
            <p style={{ color: "var(--danger)" }} className="text-sm font-medium mb-4">Código expirado.</p>
            <button
              onClick={confirmarRegenerar}
              disabled={generandoCodigo}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={generandoCodigo ? "animate-spin" : ""} />
              Generar nuevo código
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "var(--success)" }} className="text-sm font-medium mb-1">Código activo</p>
            <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Expira en: {tiempoRestante(codigoActual.expiraEn)}</p>

            {mostrarCodigo ? (
              <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)" }} className="rounded-xl p-4 flex items-center justify-between gap-3 mb-4">
                <span style={{ color: "var(--text-primary)" }} className="text-2xl font-mono font-bold tracking-[0.2em]">{codigoActual.codigo}</span>
                <button onClick={copiarCodigo} style={{ color: "var(--text-muted)" }} className="p-2 hover:[color:var(--text-primary)] transition-colors" title="Copiar código">
                  {copiado ? <Check size={18} style={{ color: "var(--success)" }} /> : <Copy size={18} />}
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {!mostrarCodigo && (
                <button
                  onClick={() => setMostrarCodigo(true)}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors"
                >
                  Mostrar código
                </button>
              )}
              {mostrarCodigo && (
                <button
                  onClick={copiarCodigo}
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors"
                >
                  <Copy size={15} />
                  {copiado ? "Copiado" : "Copiar código"}
                </button>
              )}
              <button
                onClick={() => setConfirmandoRegenerar(true)}
                disabled={generandoCodigo}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:[border-color:var(--accent)] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={15} className={generandoCodigo ? "animate-spin" : ""} />
                Regenerar código
              </button>
            </div>
          </>
        )}
      </div>

      {confirmandoRegenerar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-2">¿Generar un nuevo código?</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">Al generar un nuevo código, el código anterior dejará de ser válido.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmandoRegenerar(false)}
                disabled={generandoCodigo}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRegenerar}
                disabled={generandoCodigo}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              >
                {generandoCodigo ? "Generando..." : "Generar nuevo código"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
