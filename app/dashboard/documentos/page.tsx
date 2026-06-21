"use client";
import { useEffect, useState, useRef } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

interface Documento {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  tamaño: number;
  subidoPor: string;
  nombreUsuario: string;
  liceoId: string;
  creadoEn: string;
  destinatarios: string[];
}

export default function DocumentosPage() {
  const { usuario } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (usuario) cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const q = query(collection(db, "documentos"), where("liceoId", "==", usuario.liceoId));
    const snap = await getDocs(q);
    setDocumentos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Documento)));
    setLoading(false);
  }

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo || !usuario) return;
    setSubiendo(true);
    try {
      const storageRef = ref(storage, `documentos/${usuario.liceoId}/${Date.now()}_${archivo.name}`);
      await uploadBytes(storageRef, archivo);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, "documentos"), {
        nombre: archivo.name, url, tipo: archivo.type,
        tamaño: archivo.size, subidoPor: usuario.uid,
        nombreUsuario: usuario.nombre, liceoId: usuario.liceoId,
        creadoEn: new Date().toISOString(), destinatarios: [],
      });
      cargar();
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function eliminar(d: Documento) {
    if (!confirm("¿Eliminar este documento?")) return;
    const storageRef = ref(storage, d.url);
    try { await deleteObject(storageRef); } catch {}
    await deleteDoc(doc(db, "documentos", d.id));
    cargar();
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function iconoTipo(tipo: string) {
    if (tipo.includes("pdf")) return "📕";
    if (tipo.includes("word") || tipo.includes("document")) return "📘";
    if (tipo.includes("sheet") || tipo.includes("excel")) return "📗";
    if (tipo.includes("image")) return "🖼️";
    return "📄";
  }

  const puedeSubir = ["administrador", "coordinador", "director", "profesor", "centro_dual"].includes(usuario?.rol ?? "");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">Documentos</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{documentos.length} documento(s)</p>
        </div>
        {puedeSubir && (
          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={subirArchivo} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
            <button onClick={() => fileRef.current?.click()} disabled={subiendo}
              style={{ background: "var(--accent-blue)" }}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {subiendo ? "Subiendo..." : "+ Subir documento"}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : documentos.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay documentos aún.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {documentos.map((d) => (
            <div key={d.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-xl px-5 py-4 flex items-center gap-4 hover:border-blue-500/40 transition-colors">
              <span className="text-2xl">{iconoTipo(d.tipo)}</span>
              <div className="flex-1 min-w-0">
                <p style={{ color: "var(--text-primary)" }} className="text-sm font-medium truncate">{d.nombre}</p>
                <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                  {formatBytes(d.tamaño)} · {d.nombreUsuario} · {new Date(d.creadoEn).toLocaleDateString("es-CL")}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <a href={d.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--accent-blue-light)" }} className="text-xs hover:underline">
                  Abrir
                </a>
                {(usuario?.rol === "administrador" || usuario?.uid === d.subidoPor) && (
                  <button onClick={() => eliminar(d)} style={{ color: "var(--danger)" }} className="text-xs hover:underline">Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
