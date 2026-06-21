"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Estudiante } from "@/types";

const EMPTY: Omit<Estudiante, "id" | "creadoEn"> = {
  run: "", nombres: "", apellidos: "", email: "", telefono: "",
  curso: "", nivel: "", especialidadId: "", liceoId: "",
  centroDualId: "", profesorId: "", estado: "activo",
};

export default function EstudiantesPage() {
  const { usuario } = useAuth();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const puedeEditar = usuario?.rol === "administrador" || usuario?.rol === "profesor";

  useEffect(() => {
    if (!usuario) return;
    cargar();
  }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    let q;
    if (usuario.rol === "administrador" || usuario.rol === "coordinador" || usuario.rol === "director") {
      q = query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId));
    } else if (usuario.rol === "profesor") {
      q = query(collection(db, "estudiantes"), where("profesorId", "==", usuario.uid));
    } else {
      q = query(collection(db, "estudiantes"), where("liceoId", "==", usuario.liceoId));
    }
    const snap = await getDocs(q);
    setEstudiantes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Estudiante)));
    setLoading(false);
  }

  async function guardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "estudiantes", editId), { ...form });
      } else {
        await addDoc(collection(db, "estudiantes"), {
          ...form,
          liceoId: usuario.liceoId,
          profesorId: usuario.uid,
          creadoEn: new Date().toISOString(),
        });
      }
      setModal(false);
      setForm(EMPTY);
      setEditId(null);
      cargar();
    } finally {
      setGuardando(false);
    }
  }

  function abrirEditar(e: Estudiante) {
    setForm({ run: e.run, nombres: e.nombres, apellidos: e.apellidos, email: e.email ?? "", telefono: e.telefono ?? "", curso: e.curso, nivel: e.nivel, especialidadId: e.especialidadId, liceoId: e.liceoId, centroDualId: e.centroDualId ?? "", profesorId: e.profesorId ?? "", estado: e.estado });
    setEditId(e.id);
    setModal(true);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este estudiante?")) return;
    await deleteDoc(doc(db, "estudiantes", id));
    cargar();
  }

  const filtrados = estudiantes.filter((e) =>
    `${e.nombres} ${e.apellidos} ${e.run}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const estadoColor: Record<string, string> = {
    activo: "var(--success)",
    inactivo: "var(--danger)",
    egresado: "var(--warning)",
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">Estudiantes</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{filtrados.length} estudiante(s) encontrado(s)</p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => { setForm(EMPTY); setEditId(null); setModal(true); }}
            style={{ background: "var(--accent-blue)" }}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            + Agregar estudiante
          </button>
        )}
      </div>

      {/* Buscador */}
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o RUN..."
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
        className="w-full px-4 py-3 rounded-xl text-sm mb-6 outline-none focus:border-blue-500 transition-colors"
      />

      {/* Tabla */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-12 text-center">
          <p style={{ color: "var(--text-muted)" }} className="text-sm">No hay estudiantes registrados aún.</p>
          {puedeEditar && <p style={{ color: "var(--text-muted)" }} className="text-xs mt-2">Haz clic en "Agregar estudiante" para comenzar.</p>}
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                {["RUN", "Nombre completo", "Curso", "Estado", "Acciones"].map((h) => (
                  <th key={h} style={{ color: "var(--text-muted)" }} className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: i < filtrados.length - 1 ? "1px solid var(--border)" : "none" }} className="hover:bg-white/2 transition-colors">
                  <td style={{ color: "var(--text-secondary)" }} className="px-5 py-4">{e.run}</td>
                  <td style={{ color: "var(--text-primary)" }} className="px-5 py-4 font-medium">{e.nombres} {e.apellidos}</td>
                  <td style={{ color: "var(--text-secondary)" }} className="px-5 py-4">{e.curso}</td>
                  <td className="px-5 py-4">
                    <span style={{ color: estadoColor[e.estado], background: estadoColor[e.estado] + "22" }} className="px-3 py-1 rounded-full text-xs font-medium capitalize">
                      {e.estado}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {puedeEditar && (
                      <div className="flex gap-2">
                        <button onClick={() => abrirEditar(e)} style={{ color: "var(--accent-blue-light)" }} className="text-xs hover:underline">Editar</button>
                        <button onClick={() => eliminar(e.id)} style={{ color: "var(--danger)" }} className="text-xs hover:underline">Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-lg rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-6">
              {editId ? "Editar estudiante" : "Agregar estudiante"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "run", label: "RUN", placeholder: "12.345.678-9" },
                { key: "nombres", label: "Nombres", placeholder: "Juan Andrés" },
                { key: "apellidos", label: "Apellidos", placeholder: "González Pérez" },
                { key: "email", label: "Correo", placeholder: "juan@email.com" },
                { key: "telefono", label: "Teléfono", placeholder: "+56 9 1234 5678" },
                { key: "curso", label: "Curso", placeholder: "3° Medio A" },
                { key: "nivel", label: "Nivel", placeholder: "3° Medio" },
                { key: "especialidadId", label: "Especialidad", placeholder: "Contabilidad" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">{label}</label>
                  <input
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              ))}
              <div>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as Estudiante["estado"] }))}
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="egresado">Egresado</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setModal(false); setEditId(null); }}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                style={{ background: "var(--accent-blue)" }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              >
                {guardando ? "Guardando..." : editId ? "Guardar cambios" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
