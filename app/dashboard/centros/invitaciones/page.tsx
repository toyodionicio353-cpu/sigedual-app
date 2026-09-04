"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useModoGlobalAdmin, useCatalogoLiceos } from "@/lib/liceos/modoGlobalAdmin";
import type { InvitacionEmpresa, EstadoInvitacion } from "@/types";
import { Inbox, ChevronRight, Copy, Ban, Send } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

const ESTADO_LABEL: Record<EstadoInvitacion, string> = {
  generado: "Generado", abierto: "Abierto por la empresa", enviado: "Enviado por la empresa",
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

export default function InvitacionesRecibidasPage() {
  const { usuario } = useAuth();
  const modoGlobal = useModoGlobalAdmin();
  const { liceos } = useCatalogoLiceos(modoGlobal);
  const liceoNombrePorId = Object.fromEntries(liceos.map((l) => [l.id, l.nombre]));

  const [invitaciones, setInvitaciones] = useState<InvitacionEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    let snap;
    if (usuario.rol === "profesor") {
      snap = await getDocs(query(collection(db, "invitaciones"), where("profesorUid", "==", usuario.uid)));
    } else if (modoGlobal) {
      snap = await getDocs(collection(db, "invitaciones"));
    } else {
      snap = await getDocs(query(collection(db, "invitaciones"), where("liceoId", "==", usuario.liceoId)));
    }
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InvitacionEmpresa));
    lista.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""));
    setInvitaciones(lista);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, modoGlobal]);

  async function copiarEnlace(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invitacion/${id}`);
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
      await updateDoc(doc(db, "invitaciones", id), { estado: "revocado" });
      setInvitaciones((lista) => lista.map((inv) => (inv.id === id ? { ...inv, estado: "revocado" } : inv)));
    } finally {
      setRevocando(null);
    }
  }

  const puedeGenerar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<Inbox size={28} />}>Formularios recibidos</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Invitaciones enviadas a empresas duales y el estado de sus formularios.
          </p>
        </div>
        {puedeGenerar && (
          <Link href="/dashboard/centros/invitaciones/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity text-center flex-shrink-0 flex items-center justify-center gap-1.5">
            <Send size={15} /> Generar invitación
          </Link>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : invitaciones.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Aún no has generado invitaciones</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Genera un enlace para que una empresa complete sus datos sin necesitar una cuenta.</p>
          {puedeGenerar && (
            <Link href="/dashboard/centros/invitaciones/nueva" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              <Send size={15} /> Generar invitación
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {invitaciones.map((inv) => (
            <div key={inv.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{inv.nombrePreliminar || "Invitación sin nombre preliminar"}</p>
                  <span style={{ color: ESTADO_COLOR[inv.estado], background: `${ESTADO_COLOR[inv.estado]}22` }} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                    {ESTADO_LABEL[inv.estado]}
                  </span>
                </div>
                <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1">
                  Generada el {formatearFecha(inv.creadoEn)} por {inv.profesorNombre}
                  {modoGlobal && ` · ${liceoNombrePorId[inv.liceoId] || "—"}`}
                </p>
                {inv.contactoNombre && (
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">Contacto: {inv.contactoNombre}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(inv.estado === "generado" || inv.estado === "abierto") && (
                  <>
                    <button onClick={() => copiarEnlace(inv.id)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                      <Copy size={13} /> {copiadoId === inv.id ? "Copiado" : "Copiar enlace"}
                    </button>
                    <button onClick={() => revocar(inv.id)} disabled={revocando === inv.id} style={{ background: "var(--danger)22", color: "var(--danger)" }} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                      <Ban size={13} /> Revocar
                    </button>
                  </>
                )}
                {(inv.estado === "enviado" || inv.estado === "en_revision" || inv.estado === "procesado") && (
                  <Link href={`/dashboard/centros/invitaciones/${inv.id}`} style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    Ver formulario <ChevronRight size={13} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
