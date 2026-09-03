"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Asignacion, CentroDual, Especialidad, MaestroGuia } from "@/types";

export default function DiagFullPage() {
  const { usuario } = useAuth();
  const [maestros, setMaestros] = useState<MaestroGuia[]>([]);
  const [centros, setCentros] = useState<CentroDual[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    setError(false);
    try {
      const [snapMg, snapCentros, snapEsp, snapAsig] = await Promise.all([
        getDocs(query(collection(db, "maestros_guia"), where("liceoId", "==", usuario.liceoId))),
        getDocs(query(collection(db, "centros_duales"), where("liceoId", "==", usuario.liceoId))),
        getDocs(query(collection(db, "especialidades"), where("liceoId", "==", usuario.liceoId))),
        getDocs(query(collection(db, "asignaciones"), where("liceoId", "==", usuario.liceoId))),
      ]);
      setMaestros(snapMg.docs.map((d) => ({ id: d.id, ...d.data() } as MaestroGuia)));
      setCentros(snapCentros.docs.map((d) => ({ id: d.id, ...d.data() } as CentroDual)));
      setEspecialidades(snapEsp.docs.map((d) => ({ id: d.id, ...d.data() } as Especialidad)));
      setAsignaciones(snapAsig.docs.map((d) => ({ id: d.id, ...d.data() } as Asignacion)));
    } catch (err) {
      console.error("Error al cargar maestros guía:", err);
      setError(true);
      setErrMsg(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  return (
    <div style={{ padding: 24 }}>
      <p>DIAG v3 — solo conteos crudos, sin ningún cálculo.</p>
      <p>loading: {String(loading)}</p>
      <p>error: {String(error)} {errMsg}</p>
      <p>maestros: {maestros.length}</p>
      <p>centros: {centros.length}</p>
      <p>especialidades: {especialidades.length}</p>
      <p>asignaciones: {asignaciones.length}</p>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>
        {JSON.stringify(maestros, null, 2).slice(0, 3000)}
      </pre>
    </div>
  );
}
