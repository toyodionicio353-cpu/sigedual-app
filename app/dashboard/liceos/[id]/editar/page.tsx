"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import LiceoForm, { type LiceoFormValues, type EspecialidadForm } from "../../_components/LiceoForm";
import type { Liceo, Especialidad } from "@/types";
import { ArrowLeft, Pencil } from "lucide-react";
import TituloPagina from "@/components/TituloPagina";

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

  const puedeGestionar = usuario?.rol === "administrador";

  async function cargar() {
    if (!id) return;
    setLoading(true);
    const [snapLiceo, snapEsp, snapTodos] = await Promise.all([
      getDoc(doc(db, "liceos", id)),
      getDocs(query(collection(db, "especialidades"), where("liceoId", "==", id))),
      getDocs(collection(db, "liceos")),
    ]);
    if (!snapLiceo.exists()) {
      setNoEncontrado(true);
      setLoading(false);
      return;
    }
    const l = snapLiceo.data() as Liceo;
    const s = (v: unknown) => (v == null ? "" : String(v));
    setValores({
      nombre: s(l.nombre), nombreCorto: s(l.nombreCorto), rut: s(l.rut),
      tipoEstablecimiento: s(l.tipoEstablecimiento), dependencia: s(l.dependencia),
      rbd: s(l.rbd), direccion: s(l.direccion), comuna: s(l.comuna),
      ciudad: s(l.ciudad), region: s(l.region),
      responsableNombre: s(l.responsableNombre), responsableCargo: s(l.responsableCargo),
      responsableRun: s(l.responsableRun), responsableTelefono: s(l.responsableTelefono),
      responsableEmail: s(l.responsableEmail),
      telefono: s(l.telefono), email: s(l.email), sitioWeb: s(l.sitioWeb),
      dominioCorreo: s(l.dominioCorreo),
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
    setLoading(false);
  }

  useEffect(() => {
    if (usuario && id) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, id]);

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

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <TituloPagina icon={<Pencil size={28} />}>Editar liceo</TituloPagina>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">Actualiza la información del establecimiento.</p>
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
    </div>
  );
}
