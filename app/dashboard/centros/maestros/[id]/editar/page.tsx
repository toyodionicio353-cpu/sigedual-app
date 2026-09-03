"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizarRut } from "@/lib/rut";
import MaestroGuiaForm, { type MaestroGuiaFormValues } from "../../_components/MaestroGuiaForm";
import type { CentroDual, Especialidad, MaestroGuia } from "@/types";
import { ArrowLeft } from "lucide-react";

export default function EditarMaestroGuiaPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const router = useRouter();

  const [mgOriginal, setMgOriginal] = useState<MaestroGuia | null>(null);
  const [centro, setCentro] = useState<CentroDual | null>(null);
  const [valores, setValores] = useState<MaestroGuiaFormValues | null>(null);
  const [especialidadesSel, setEspecialidadesSel] = useState<string[]>([]);
  const [areasSel, setAreasSel] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [rutsOcupados, setRutsOcupados] = useState<{ run: string; centroDualId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorSistema, setErrorSistema] = useState("");
  const [mensaje, setMensaje] = useState("");

  const puedeEditar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (!usuario || !id || !puedeEditar) return;
    async function cargar() {
      setLoading(true);
      const snapMg = await getDoc(doc(db, "maestros_guia", id));
      if (!snapMg.exists()) {
        setNoEncontrado(true);
        setLoading(false);
        return;
      }
      const m = { id: snapMg.id, ...snapMg.data() } as MaestroGuia;
      setMgOriginal(m);
      setValores({
        nombres: m.nombres ?? "", apellidoPaterno: m.apellidoPaterno ?? "", apellidoMaterno: m.apellidoMaterno ?? "",
        run: m.run ?? "", email: m.email ?? "", telefono: m.telefono ?? "", cargo: m.cargo ?? "",
        area: m.area ?? "", aniosExperiencia: m.aniosExperiencia != null ? String(m.aniosExperiencia) : "",
        capacidad: m.capacidad != null ? String(m.capacidad) : "", estado: m.estado ?? "activo",
        observaciones: m.observaciones ?? "",
      });
      setEspecialidadesSel(m.especialidades ?? []);
      setAreasSel(m.areasSupervision ?? []);

      const [snapCentro, snapEsp, snapMgTodos] = await Promise.all([
        getDoc(doc(db, "centros_duales", m.centroDualId)),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario!.liceoId))),
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario!.liceoId))),
      ]);
      if (snapCentro.exists()) setCentro({ id: snapCentro.id, ...snapCentro.data() } as CentroDual);
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setRutsOcupados(
        snapMgTodos.docs
          .filter((d) => d.id !== id)
          .map((d) => {
            const mg = d.data() as MaestroGuia;
            return { run: mg.run, centroDualId: mg.centroDualId };
          })
      );
      setLoading(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id, puedeEditar]);

  async function guardar(form: MaestroGuiaFormValues, _centroDualId: string, nuevasEspecialidades: string[], nuevasAreas: string[]) {
    if (!usuario || !id || !mgOriginal || guardando) return;
    setGuardando(true);
    setErrorSistema("");
    setMensaje("");
    try {
      await updateDoc(doc(db, "maestros_guia", id), {
        nombres: form.nombres.trim(),
        apellidoPaterno: form.apellidoPaterno.trim(),
        apellidoMaterno: form.apellidoMaterno.trim(),
        run: normalizarRut(form.run),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        cargo: form.cargo.trim(),
        area: form.area.trim(),
        aniosExperiencia: form.aniosExperiencia.trim() ? Number(form.aniosExperiencia) : undefined,
        especialidades: nuevasEspecialidades,
        areasSupervision: nuevasAreas,
        capacidad: form.capacidad.trim() ? Number(form.capacidad) : undefined,
        estado: form.estado,
        observaciones: form.observaciones.trim(),
        actualizadoEn: new Date().toISOString(),
      });
      setMensaje("Cambios guardados correctamente.");
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setErrorSistema(`No se pudieron guardar los cambios. Intenta nuevamente. (${detalle})`);
    } finally {
      setGuardando(false);
    }
  }

  if (usuario && !puedeEditar) {
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

  if (noEncontrado || !centro) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-base font-semibold mb-1">Maestro guía no encontrado</p>
          <Link href="/dashboard/centros" style={{ background: "var(--accent)", color: "var(--text-on-accent)" }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity mt-4">
            <ArrowLeft size={16} />
            Volver a centros duales
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-3xl font-bold">Editar maestro guía</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Actualiza los datos de {mgOriginal?.nombres} {mgOriginal?.apellidoPaterno}.</p>
        </div>
        <Link
          href={`/dashboard/centros/maestros/${id}`}
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

      <MaestroGuiaForm
        modo="editar"
        valoresIniciales={valores}
        centrosDisponibles={[]}
        centroFijo={centro}
        especialidadesIniciales={especialidadesSel}
        areasIniciales={areasSel}
        especialidadesDisponibles={especialidades}
        rutsOcupadosPorCentro={rutsOcupados}
        guardando={guardando}
        onCancelar={() => router.push(`/dashboard/centros/maestros/${id}`)}
        onGuardar={guardar}
      />
    </div>
  );
}
