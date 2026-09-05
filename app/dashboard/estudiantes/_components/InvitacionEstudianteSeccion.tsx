"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import type { InvitacionEstudiante, EstadoInvitacion } from "@/types";
import { Send, Inbox, Copy, Ban, ChevronRight, CheckCircle2, Wand2 } from "lucide-react";

const HORAS_EXPIRACION = 24;

const ESTADO_LABEL: Record<EstadoInvitacion, string> = {
  generado: "Generado", abierto: "Abierto por el estudiante", enviado: "Enviado por el estudiante",
  en_revision: "En revisión", procesado: "Procesado", expirado: "Expirado", revocado: "Revocado",
};
const ESTADO_COLOR: Record<EstadoInvitacion, string> = {
  generado: "var(--text-muted)", abierto: "var(--accent-light)", enviado: "var(--success)",
  en_revision: "var(--warning)", procesado: "var(--success)", expirado: "var(--danger)", revocado: "var(--danger)",
};

function formatearFecha(iso?: string): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

/** Bloque de "Agregar estudiante" para invitar al estudiante (o su
 * apoderado) a completar su propia ficha: un botón que genera un enlace
 * válido por 24 horas (sin pantalla ni formulario previo), y debajo la
 * bandeja de formularios ya recibidos con la acción "Autocompletar" hacia
 * el detalle donde se revisa la respuesta y se vuelca a `estudiantes`. */
export default function InvitacionEstudianteSeccion() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = Object.fromEntries(liceos.map((l) => [l.id, l.nombre]));
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();

  const [invitaciones, setInvitaciones] = useState<InvitacionEstudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [enlaceGenerado, setEnlaceGenerado] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);

  const puedeGenerar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    let snap;
    if (usuario.rol === "profesor") {
      snap = await getDocs(query(collection(db, "invitaciones_estudiante"), where("profesorUid", "==", usuario.uid)));
    } else if (modoGlobal) {
      snap = await getDocs(collection(db, "invitaciones_estudiante"));
    } else {
      snap = await getDocs(query(collection(db, "invitaciones_estudiante"), where("liceoId", "==", usuario.liceoId)));
    }
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InvitacionEstudiante));
    lista.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""));
    setInvitaciones(lista);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoGlobal]);

  async function generar() {
    if (!usuario || generando) return;
    setGenerando(true);
    try {
      const id = crypto.randomUUID();
      const ahora = new Date();
      const expira = new Date(ahora.getTime() + HORAS_EXPIRACION * 60 * 60 * 1000);
      const nueva: Omit<InvitacionEstudiante, "id"> = {
        liceoId: usuario.liceoId,
        profesorUid: usuario.uid,
        profesorNombre: usuario.nombre,
        estado: "generado",
        creadoEn: ahora.toISOString(),
        expiraEn: expira.toISOString(),
      };
      await setDoc(doc(db, "invitaciones_estudiante", id), nueva);
      setEnlaceGenerado(`${window.location.origin}/invitacion/estudiante/${id}`);
      setInvitaciones((lista) => [{ id, ...nueva }, ...lista]);
    } finally {
      setGenerando(false);
    }
  }

  async function copiarEnlace(texto: string, id: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2000);
    } catch {
      // portapapeles no disponible
    }
  }

  async function revocar(id: string) {
    if (revocando) return;
    setRevocando(id);
    try {
      await updateDoc(doc(db, "invitaciones_estudiante", id), { estado: "revocado" });
      setInvitaciones((lista) => lista.map((inv) => (inv.id === id ? { ...inv, estado: "revocado" } : inv)));
    } finally {
      setRevocando(null);
    }
  }

  if (!puedeGenerar) return null;

  return (
    <div style={{ borderTop: "1px solid var(--border)" }} className="mt-8 pt-8">
      <div className="mb-4">
        <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold flex items-center gap-2">
          <Send size={20} style={{ color: "var(--accent)" }} />
          ¿Prefieres que el estudiante complete sus datos?
        </h2>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Genera un enlace único para que el estudiante (o su apoderado) complete su información, sin necesitar una cuenta. Es válido por {HORAS_EXPIRACION} horas.
        </p>
      </div>

      <button
        onClick={() => conConfirmacion(generar)}
        disabled={generando}
        style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
      >
        <Send size={15} />
        {generando ? "Generando..." : "Generar formulario para Estudiante"}
      </button>

      {enlaceGenerado && (
        <div style={{ background: "var(--success)11", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mt-4 flex items-center gap-2">
          <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="flex-shrink-0" />
          <code style={{ color: "var(--text-primary)" }} className="text-xs flex-1 truncate">{enlaceGenerado}</code>
          <button
            onClick={() => copiarEnlace(enlaceGenerado, "nuevo")}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 flex-shrink-0"
          >
            <Copy size={13} /> {copiadoId === "nuevo" ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}

      <div className="mt-8">
        <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-bold flex items-center gap-2 mb-3">
          <Inbox size={16} style={{ color: "var(--text-muted)" }} />
          Formularios recibidos
        </h3>

        {loading ? (
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
        ) : invitaciones.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }} className="text-sm">Aún no has generado ningún formulario.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {invitaciones.map((inv) => (
              <div key={inv.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">
                      {inv.nombrePreliminar || `Formulario generado el ${formatearFecha(inv.creadoEn)}`}
                    </p>
                    <span style={{ color: ESTADO_COLOR[inv.estado], background: `${ESTADO_COLOR[inv.estado]}22` }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                      {ESTADO_LABEL[inv.estado]}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
                    Generado el {formatearFecha(inv.creadoEn)}
                    {modoGlobal && ` · ${liceoNombrePorId[inv.liceoId] || "—"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(inv.estado === "generado" || inv.estado === "abierto") && (
                    <>
                      <button onClick={() => copiarEnlace(`${window.location.origin}/invitacion/estudiante/${inv.id}`, inv.id)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                        <Copy size={13} /> {copiadoId === inv.id ? "Copiado" : "Copiar enlace"}
                      </button>
                      <button onClick={() => revocar(inv.id)} disabled={revocando === inv.id} style={{ background: "var(--danger)22", color: "var(--danger)" }} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                        <Ban size={13} /> Revocar
                      </button>
                    </>
                  )}
                  {(inv.estado === "enviado" || inv.estado === "en_revision") && (
                    <Link href={`/dashboard/estudiantes/invitaciones/${inv.id}`} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                      <Wand2 size={13} /> Autocompletar
                    </Link>
                  )}
                  {inv.estado === "procesado" && (
                    <Link href={`/dashboard/estudiantes/invitaciones/${inv.id}`} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                      Ver formulario <ChevronRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="una invitación para estudiante" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}
    </div>
  );
}
