"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import { useAdvertenciaLiceoGlobal } from "@/lib/liceos/useAdvertenciaLiceoGlobal";
import ModalAdvertenciaLiceo from "@/components/liceos/ModalAdvertenciaLiceo";
import type { InvitacionEstudiante, EstadoInvitacion, CampaniaInvitacionEstudiante, EstadoCampania } from "@/types";
import { Send, Inbox, Copy, Ban, ChevronRight, CheckCircle2, Wand2, Layers } from "lucide-react";

const HORAS_EXPIRACION = 24;

const ESTADO_LABEL: Record<EstadoInvitacion, string> = {
  generado: "Generado", abierto: "Abierto por el estudiante", enviado: "Enviado por el estudiante",
  en_revision: "En revisión", procesado: "Procesado", expirado: "Expirado", revocado: "Revocado",
};
const ESTADO_COLOR: Record<EstadoInvitacion, string> = {
  generado: "var(--text-muted)", abierto: "var(--accent-light)", enviado: "var(--success)",
  en_revision: "var(--warning)", procesado: "var(--success)", expirado: "var(--danger)", revocado: "var(--danger)",
};

const ESTADO_CAMPANIA_LABEL: Record<EstadoCampania, string> = {
  activa: "Activa", completa: "Completa", expirada: "Expirada", revocada: "Revocada",
};
const ESTADO_CAMPANIA_COLOR: Record<EstadoCampania, string> = {
  activa: "var(--accent-light)", completa: "var(--success)", expirada: "var(--danger)", revocada: "var(--danger)",
};

function formatearFecha(iso?: string): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

const inputStyle = { background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] transition-colors";

/** Bloque de "Agregar estudiante" para invitar al estudiante (o su
 * apoderado) a completar su propia ficha. Dos modalidades: "Individual"
 * (enlace de un solo uso, comportamiento original sin cambios) y "Masivo"
 * (un mismo enlace recibe muchas respuestas independientes hasta un cupo). */
export default function InvitacionEstudianteSeccion() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = Object.fromEntries(liceos.map((l) => [l.id, l.nombre]));
  const { liceoPredeterminado, mostrarAdvertencia, conConfirmacion, confirmar, cancelar } = useAdvertenciaLiceoGlobal();

  const [modo, setModo] = useState<"individual" | "masivo">("individual");

  const [invitaciones, setInvitaciones] = useState<InvitacionEstudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [enlaceGenerado, setEnlaceGenerado] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);

  const [campanias, setCampanias] = useState<CampaniaInvitacionEstudiante[]>([]);
  const [loadingCampanias, setLoadingCampanias] = useState(true);
  const [nombreCampania, setNombreCampania] = useState("");
  const [capacidadCampania, setCapacidadCampania] = useState("30");
  const [expiraCampania, setExpiraCampania] = useState("");
  const [generandoCampania, setGenerandoCampania] = useState(false);
  const [enlaceCampaniaGenerado, setEnlaceCampaniaGenerado] = useState<string | null>(null);

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

  async function cargarCampanias() {
    if (!usuario) return;
    setLoadingCampanias(true);
    let snap;
    if (usuario.rol === "profesor") {
      snap = await getDocs(query(collection(db, "campanias_invitacion_estudiante"), where("profesorUid", "==", usuario.uid)));
    } else if (modoGlobal) {
      snap = await getDocs(collection(db, "campanias_invitacion_estudiante"));
    } else {
      snap = await getDocs(query(collection(db, "campanias_invitacion_estudiante"), where("liceoId", "==", usuario.liceoId)));
    }
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampaniaInvitacionEstudiante));
    lista.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""));
    setCampanias(lista);
    setLoadingCampanias(false);
  }

  useEffect(() => {
    cargar();
    cargarCampanias();
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

  async function generarCampania() {
    if (!usuario || generandoCampania) return;
    const capacidad = Number(capacidadCampania);
    if (!nombreCampania.trim() || !Number.isFinite(capacidad) || capacidad < 1) return;
    setGenerandoCampania(true);
    try {
      const id = crypto.randomUUID();
      const ahora = new Date();
      const nueva: Omit<CampaniaInvitacionEstudiante, "id"> = {
        liceoId: usuario.liceoId,
        profesorUid: usuario.uid,
        profesorNombre: usuario.nombre,
        nombre: nombreCampania.trim(),
        capacidad,
        respuestasCount: 0,
        estado: "activa",
        creadoEn: ahora.toISOString(),
        ...(expiraCampania ? { expiraEn: new Date(expiraCampania).toISOString() } : {}),
      };
      await setDoc(doc(db, "campanias_invitacion_estudiante", id), nueva);
      setEnlaceCampaniaGenerado(`${window.location.origin}/invitacion/estudiante/campania/${id}`);
      setCampanias((lista) => [{ id, ...nueva }, ...lista]);
      setNombreCampania("");
      setCapacidadCampania("30");
      setExpiraCampania("");
    } finally {
      setGenerandoCampania(false);
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

  async function revocarCampania(id: string) {
    if (revocando) return;
    setRevocando(id);
    try {
      await updateDoc(doc(db, "campanias_invitacion_estudiante", id), { estado: "revocada" });
      setCampanias((lista) => lista.map((c) => (c.id === id ? { ...c, estado: "revocada" } : c)));
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
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setModo("individual")}
          style={{
            background: modo === "individual" ? "var(--accent)" : "var(--bg-surface)",
            color: modo === "individual" ? "var(--text-on-accent)" : "var(--text-secondary)",
            border: `1px solid ${modo === "individual" ? "var(--accent)" : "var(--border)"}`,
          }}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          Formulario individual
        </button>
        <button
          onClick={() => setModo("masivo")}
          style={{
            background: modo === "masivo" ? "var(--accent)" : "var(--bg-surface)",
            color: modo === "masivo" ? "var(--text-on-accent)" : "var(--text-secondary)",
            border: `1px solid ${modo === "masivo" ? "var(--accent)" : "var(--border)"}`,
          }}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          Formulario masivo
        </button>
      </div>

      {modo === "individual" ? (
        <>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
            Genera un enlace de un solo uso para que el estudiante (o su apoderado) complete su información, sin necesitar una cuenta. Después de enviar el formulario, el enlace queda inutilizado. Es válido por {HORAS_EXPIRACION} horas.
          </p>

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
        </>
      ) : (
        <>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
            Genera un enlace para recibir múltiples formularios independientes hasta alcanzar el límite configurado — cada persona que lo complete crea su propio registro, nunca comparten uno.
          </p>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="sm:col-span-1">
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nombre o referencia</label>
              <input value={nombreCampania} onChange={(e) => setNombreCampania(e.target.value)} placeholder="Registro estudiantes 4° Medio 2027" style={inputStyle} className={inputClass} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Cantidad máxima</label>
              <input type="number" min={1} value={capacidadCampania} onChange={(e) => setCapacidadCampania(e.target.value)} style={inputStyle} className={inputClass} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Fecha de vencimiento (opcional)</label>
              <input type="date" value={expiraCampania} onChange={(e) => setExpiraCampania(e.target.value)} style={inputStyle} className={inputClass} />
            </div>
          </div>

          <button
            onClick={() => conConfirmacion(generarCampania)}
            disabled={generandoCampania || !nombreCampania.trim()}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            <Layers size={15} />
            {generandoCampania ? "Generando..." : "Generar enlace masivo"}
          </button>

          {enlaceCampaniaGenerado && (
            <div style={{ background: "var(--success)11", border: "1px solid var(--success)" }} className="rounded-xl px-4 py-3 mt-4 flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="flex-shrink-0" />
              <code style={{ color: "var(--text-primary)" }} className="text-xs flex-1 truncate">{enlaceCampaniaGenerado}</code>
              <button
                onClick={() => copiarEnlace(enlaceCampaniaGenerado, "nueva")}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 flex-shrink-0"
              >
                <Copy size={13} /> {copiadoId === "nueva" ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}

          <div className="mt-8">
            <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-bold flex items-center gap-2 mb-3">
              <Layers size={16} style={{ color: "var(--text-muted)" }} />
              Formularios masivos
            </h3>

            {loadingCampanias ? (
              <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
            ) : campanias.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }} className="text-sm">Aún no has generado ningún formulario masivo.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {campanias.map((c) => (
                  <div key={c.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{c.nombre}</p>
                        <span style={{ color: ESTADO_CAMPANIA_COLOR[c.estado], background: `${ESTADO_CAMPANIA_COLOR[c.estado]}22` }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                          {ESTADO_CAMPANIA_LABEL[c.estado]}
                        </span>
                      </div>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
                        {c.respuestasCount}/{c.capacidad} respuestas · Generado el {formatearFecha(c.creadoEn)}
                        {modoGlobal && ` · ${liceoNombrePorId[c.liceoId] || "—"}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.estado === "activa" && (
                        <>
                          <button onClick={() => copiarEnlace(`${window.location.origin}/invitacion/estudiante/campania/${c.id}`, c.id)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                            <Copy size={13} /> {copiadoId === c.id ? "Copiado" : "Copiar enlace"}
                          </button>
                          <button onClick={() => revocarCampania(c.id)} disabled={revocando === c.id} style={{ background: "var(--danger)22", color: "var(--danger)" }} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                            <Ban size={13} /> Revocar
                          </button>
                        </>
                      )}
                      {c.respuestasCount > 0 && (
                        <Link href={`/dashboard/estudiantes/campanias/${c.id}`} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                          Ver respuestas <ChevronRight size={13} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {mostrarAdvertencia && liceoPredeterminado && (
        <ModalAdvertenciaLiceo entidad="una invitación para estudiante" liceoNombre={liceoPredeterminado.nombre} onConfirmar={confirmar} onCancelar={cancelar} />
      )}
    </div>
  );
}
