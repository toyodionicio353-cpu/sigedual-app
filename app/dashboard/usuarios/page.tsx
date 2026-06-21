"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Usuario, Rol } from "@/types";

const ROLES: { value: Rol; label: string }[] = [
  { value: "coordinador", label: "Coordinador" },
  { value: "director", label: "Director" },
  { value: "profesor", label: "Profesor Supervisor" },
  { value: "centro_dual", label: "Centro Dual" },
  { value: "estudiante", label: "Estudiante" },
];

const EMPTY = { email: "", password: "", nombre: "", rol: "profesor" as Rol, especialidad: "", liceoId: "" };

export default function UsuariosPage() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (usuario?.rol === "administrador") cargar(); }, [usuario]);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    const q = query(collection(db, "usuarios"), where("liceoId", "==", usuario.liceoId));
    const snap = await getDocs(q);
    setUsuarios(snap.docs.map((d) => ({ ...d.data() } as Usuario)));
    setLoading(false);
  }

  async function crearUsuario() {
    setError(""); setGuardando(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        uid: cred.user.uid, email: form.email, nombre: form.nombre,
        rol: form.rol, especialidad: form.especialidad,
        liceoId: form.liceoId || usuario?.liceoId || "",
        activo: true, creadoEn: new Date().toISOString(),
      });
      setModal(false); setForm(EMPTY); cargar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear usuario");
    } finally { setGuardando(false); }
  }

  async function toggleActivo(u: Usuario) {
    await updateDoc(doc(db, "usuarios", u.uid), { activo: !u.activo });
    cargar();
  }

  if (usuario?.rol !== "administrador") {
    return (
      <div className="p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  const ROL_LABEL: Record<Rol, string> = {
    administrador: "Administrador", coordinador: "Coordinador", director: "Director",
    profesor: "Profesor Supervisor", centro_dual: "Centro Dual", estudiante: "Estudiante",
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">Usuarios</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{usuarios.length} usuario(s) en el sistema</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setModal(true); }} style={{ background: "var(--accent-blue)" }} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          + Crear usuario
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                {["Nombre", "Correo", "Rol", "Especialidad", "Estado", "Acción"].map((h) => (
                  <th key={h} style={{ color: "var(--text-muted)" }} className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <tr key={u.uid} style={{ borderBottom: i < usuarios.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ color: "var(--text-primary)" }} className="px-5 py-4 font-medium">{u.nombre}</td>
                  <td style={{ color: "var(--text-secondary)" }} className="px-5 py-4">{u.email}</td>
                  <td style={{ color: "var(--accent-blue-light)" }} className="px-5 py-4">{ROL_LABEL[u.rol]}</td>
                  <td style={{ color: "var(--text-secondary)" }} className="px-5 py-4">{u.especialidad || "—"}</td>
                  <td className="px-5 py-4">
                    <span style={{ color: u.activo ? "var(--success)" : "var(--danger)", background: (u.activo ? "var(--success)" : "var(--danger)") + "22" }} className="px-3 py-1 rounded-full text-xs">
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleActivo(u)} style={{ color: u.activo ? "var(--danger)" : "var(--success)" }} className="text-xs hover:underline">
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-6">Crear usuario</h2>
            <div className="flex flex-col gap-4">
              {[
                { key: "nombre", label: "Nombre completo", placeholder: "María González", type: "text" },
                { key: "email", label: "Correo electrónico", placeholder: "usuario@liceo.cl", type: "email" },
                { key: "password", label: "Contraseña temporal", placeholder: "••••••••", type: "password" },
                { key: "especialidad", label: "Especialidad (si aplica)", placeholder: "Contabilidad", type: "text" },
                { key: "liceoId", label: "ID del liceo", placeholder: usuario?.liceoId, type: "text" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">{label}</label>
                  <input type={type} value={(form as Record<string, string>)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors" />
                </div>
              ))}
              <div>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Rol</label>
                <select value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as Rol }))}
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {error && <p style={{ color: "var(--danger)" }} className="text-xs">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={crearUsuario} disabled={guardando} style={{ background: "var(--accent-blue)" }} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50">
                {guardando ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
