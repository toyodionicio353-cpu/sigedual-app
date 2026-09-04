"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import LiceoForm, { LICEO_FORM_VACIO, type LiceoFormValues, type EspecialidadForm } from "../_components/LiceoForm";
import type { Liceo } from "@/types";
import { ArrowLeft, CheckCircle2, Eye, School } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

export default function AgregarLiceoPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [dominiosOcupados, setDominiosOcupados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [registrado, setRegistrado] = useState<Liceo | null>(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const snap = await getDocs(collection(db, "liceos"));
      setDominiosOcupados(
        snap.docs.map((d) => (d.data().dominioCorreo as string | undefined)?.toLowerCase()).filter(Boolean) as string[]
      );
      setCargando(false);
    }
    cargar();
  }, []);

  async function guardar(valores: LiceoFormValues, especialidades: EspecialidadForm[]) {
    if (!usuario || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const ahora = new Date().toISOString();
      const nuevo = {
        ...valores,
        dominioCorreo: valores.dominioCorreo.trim().toLowerCase(),
        creadoEn: ahora,
        actualizadoEn: ahora,
        actualizadoPor: usuario.uid,
      };
      const ref = await addDoc(collection(db, "liceos"), nuevo);
      const activas = especialidades.filter((e) => e.estado === "activa" && e.nombre.trim());
      await Promise.all(
        activas.map((e) => addDoc(collection(db, "especialidades"), { nombre: e.nombre.trim(), liceoId: ref.id, estado: "activa" }))
      );
      setRegistrado({ id: ref.id, ...nuevo } as Liceo);
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible registrar el liceo. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <TituloPagina icon={<School size={28} />}>Agregar liceo</TituloPagina>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Registra y configura un nuevo establecimiento en SIGEDUAL.
          </p>
        </div>
        <Link
          href="/dashboard/liceos"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <ArrowLeft size={16} />
          Volver al listado
        </Link>
      </div>

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {!cargando && (
        <LiceoForm
          modo="crear"
          valoresIniciales={LICEO_FORM_VACIO}
          especialidadesIniciales={[]}
          dominiosOcupados={dominiosOcupados}
          guardando={guardando}
          onCancelar={() => router.push("/dashboard/liceos")}
          onGuardar={guardar}
        />
      )}

      {registrado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl text-center">
            <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
            </div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Liceo registrado correctamente</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">{registrado.nombre} ya está disponible en SIGEDUAL.</p>
            <div className="flex gap-3">
              <Link
                href="/dashboard/liceos"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              >
                Ir al listado
              </Link>
              <Link
                href={`/dashboard/liceos/${registrado.id}`}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Eye size={15} />
                Ver liceo
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
