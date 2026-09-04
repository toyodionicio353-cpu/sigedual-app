"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizarRut } from "@/lib/rut";
import MaestroGuiaForm, { MAESTRO_GUIA_FORM_VACIO, type MaestroGuiaFormValues } from "../_components/MaestroGuiaForm";
import type { CentroDual, Especialidad, MaestroGuia } from "@/types";
import { CheckCircle2, Eye, UserPlus } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

export default function AgregarMaestroGuiaPage() {
  const { usuario } = useAuth();

  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [rutsOcupados, setRutsOcupados] = useState<{ run: string; centroDualId: string }[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [creado, setCreado] = useState<{ mg: MaestroGuia; centro: CentroDual } | null>(null);

  useEffect(() => {
    if (!usuario) return;
    async function cargar() {
      setCargandoDatos(true);
      const [snapCentros, snapEsp, snapMg] = await Promise.all([
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setRutsOcupados(snapMg.docs.map((d) => {
        const mg = d.data() as MaestroGuia;
        return { run: mg.run, centroDualId: mg.centroDualId };
      }));
      setCargandoDatos(false);
    }
    cargar();
  }, [usuario]);

  async function guardar(
    form: MaestroGuiaFormValues,
    centroDualId: string,
    especialidadesSel: string[],
    areas: string[]
  ) {
    if (!usuario || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    try {
      const centro = centros.find((c) => c.id === centroDualId);
      if (!centro) throw new Error("Centro dual no encontrado.");
      const nuevo: Record<string, unknown> = {
        centroDualId,
        liceoId: usuario.liceoId,
        nombres: form.nombres.trim(),
        apellidoPaterno: form.apellidoPaterno.trim(),
        apellidoMaterno: form.apellidoMaterno.trim(),
        run: normalizarRut(form.run),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        cargo: form.cargo.trim(),
        area: form.area.trim(),
        especialidades: especialidadesSel,
        areasSupervision: areas,
        estado: form.estado,
        observaciones: form.observaciones.trim(),
        creadoPor: usuario.uid,
        creadoEn: new Date().toISOString(),
      };
      if (form.aniosExperiencia.trim()) nuevo.aniosExperiencia = Number(form.aniosExperiencia);
      if (form.capacidad.trim()) nuevo.capacidad = Number(form.capacidad);
      const ref = await addDoc(collection(db, "maestros_guia"), nuevo);
      setCreado({ mg: { id: ref.id, ...nuevo } as MaestroGuia, centro });
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No fue posible registrar al maestro guía. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  if (!cargandoDatos && centros.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">No puedes registrar un maestro guía todavía.</p>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-5">Primero debes registrar un centro dual.</p>
          <Link href="/dashboard/centros/nuevo" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            + Agregar centro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <TituloPagina icon={<UserPlus size={28} />}>Agregar maestro guía</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
          Registra a la persona que acompañará al estudiante en un centro dual.
        </p>
      </div>

      {errorSistema && (
        <div style={{ background: "var(--danger)22", border: "1px solid var(--danger)" }} className="rounded-xl px-4 py-3 mb-6">
          <p style={{ color: "var(--danger)" }} className="text-sm font-medium">{errorSistema}</p>
        </div>
      )}

      {!cargandoDatos && (
        <MaestroGuiaForm
          modo="crear"
          valoresIniciales={MAESTRO_GUIA_FORM_VACIO}
          centrosDisponibles={centros}
          especialidadesIniciales={[]}
          areasIniciales={[]}
          especialidadesDisponibles={especialidades}
          rutsOcupadosPorCentro={rutsOcupados}
          guardando={guardando}
          onCancelar={() => window.history.back()}
          onGuardar={guardar}
        />
      )}

      {creado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-6 shadow-2xl text-center">
            <div style={{ background: "var(--success)22", borderRadius: "9999px" }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
            </div>
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Maestro guía creado correctamente.</h2>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-xl p-4 text-left text-sm flex flex-col gap-1.5 mb-6 mt-4">
              <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Centro dual: </span>{creado.centro.nombre}</p>
              <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Maestro guía: </span>{creado.mg.nombres} {creado.mg.apellidoPaterno} {creado.mg.apellidoMaterno}</p>
              <p style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-muted)" }}>Estado: </span>{creado.mg.estado === "activo" ? "Activo" : "Inactivo"}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/dashboard/centros"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              >
                Volver a centros duales
              </Link>
              <Link
                href={`/dashboard/centros/maestros/${creado.mg.id}`}
                style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Eye size={15} />
                Ver maestro guía
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
