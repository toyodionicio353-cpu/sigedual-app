"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { RefreshCw, Trash2 } from "lucide-react";
import type { Usuario, Rol } from "@/types";

const ROLES: { value: Rol; label: string }[] = [
  { value: "coordinador", label: "Coordinador" },
  { value: "director", label: "Director" },
  { value: "profesor", label: "Profesor Supervisor" },
  { value: "centro_dual", label: "Centro Dual" },
  { value: "estudiante", label: "Estudiante" },
];

const EMPTY = { email: "", password: "", nombre: "", rol: "profesor" as Rol, especialidad: "", liceoId: "" };
const EMPTY_HUERFANO = { nombre: "", rol: "profesor" as Rol, especialidad: "", liceoId: "" };

interface Huerfano {
  uid: string;
  email: string;
}

export default function UsuariosPage() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [eliminandoUid, setEliminandoUid] = useState<string | null>(null);
  const [avisoSync, setAvisoSync] = useState("");
  const [huerfanos, setHuerfanos] = useState<Huerfano[]>([]);
  const [huerfanoActivo, setHuerfanoActivo] = useState<Huerfano | null>(null);
  const [formHuerfano, setFormHuerfano] = useState(EMPTY_HUERFANO);
  const [guardandoHuerfano, setGuardandoHuerfano] = useState(false);

  async function cargar() {
    if (!usuario) return;
    setLoading(true);
    // El administrador ve a todos los usuarios de la plataforma, sin
    // filtrar por liceo (a diferencia de otros roles, que solo verían
    // el suyo si esta pantalla se habilitara para ellos).
    const snap = await getDocs(collection(db, "usuarios"));
    setUsuarios(snap.docs.map((d) => ({ ...d.data() } as Usuario)));
    setLoading(false);
  }

  async function sincronizar(silencioso = false) {
    if (!auth.currentUser) return;
    setSincronizando(true);
    setAvisoSync("");
    let res: Response | null = null;
    try {
      const token = await auth.currentUser.getIdToken();
      res = await fetch("/api/admin/usuarios/sincronizar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const texto = await res.text();
      let data: {
        error?: string;
        eliminados?: string[];
        huerfanos?: Huerfano[];
        diagnostico?: { totalCuentasAuth: number; correosAuth: string[]; totalFichasFirestore: number };
      } = {};
      try {
        data = JSON.parse(texto);
      } catch {
        throw new Error(`El servidor respondió con código ${res.status} y algo que no es JSON: "${texto.slice(0, 200)}"`);
      }
      if (!res.ok) {
        if (!silencioso) setAvisoSync(data.error || `Error del servidor (código ${res.status}).`);
        return;
      }
      setHuerfanos(data.huerfanos ?? []);
      if (!silencioso) {
        const partes: string[] = [];
        if ((data.eliminados?.length ?? 0) > 0) partes.push(`se quitaron ${data.eliminados!.length} usuario(s) que ya no existían en Firebase`);
        if ((data.huerfanos?.length ?? 0) > 0) partes.push(`hay ${data.huerfanos!.length} cuenta(s) de Firebase sin completar en SIGEDUAL (ver abajo)`);
        const resumen = partes.length > 0 ? `Listo: ${partes.join(", ")}.` : "Todo estaba al día.";
        const d = data.diagnostico;
        const diag = d
          ? ` [Diagnóstico: ${d.totalCuentasAuth} cuenta(s) en Firebase Auth (${d.correosAuth.join(", ") || "ninguna"}), ${d.totalFichasFirestore} ficha(s) en Firestore]`
          : "";
        setAvisoSync(resumen + diag);
      }
      await cargar();
    } catch (err) {
      if (!silencioso) {
        const detalle = err instanceof Error ? err.message : String(err);
        setAvisoSync(`No se pudo sincronizar: ${detalle}`);
      }
    } finally {
      setSincronizando(false);
    }
  }

  useEffect(() => {
    if (usuario?.rol === "administrador") {
      cargar().then(() => sincronizar(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

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

  async function completarHuerfano() {
    if (!huerfanoActivo || !usuario) return;
    setGuardandoHuerfano(true);
    try {
      await setDoc(doc(db, "usuarios", huerfanoActivo.uid), {
        uid: huerfanoActivo.uid, email: huerfanoActivo.email, nombre: formHuerfano.nombre,
        rol: formHuerfano.rol, especialidad: formHuerfano.especialidad,
        liceoId: formHuerfano.liceoId || usuario.liceoId,
        activo: true, creadoEn: new Date().toISOString(),
      });
      setHuerfanos((prev) => prev.filter((h) => h.uid !== huerfanoActivo.uid));
      setHuerfanoActivo(null);
      setFormHuerfano(EMPTY_HUERFANO);
      await cargar();
    } finally {
      setGuardandoHuerfano(false);
    }
  }

  async function toggleActivo(u: Usuario) {
    await updateDoc(doc(db, "usuarios", u.uid), { activo: !u.activo });
    cargar();
  }

  async function eliminarUsuario(u: Usuario) {
    if (!auth.currentUser) return;
    if (!confirm(`¿Eliminar a ${u.nombre}? Se borrará su cuenta de acceso y no podrá volver a iniciar sesión.`)) return;
    setEliminandoUid(u.uid);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/admin/usuarios/${u.uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "No se pudo eliminar el usuario.");
        return;
      }
      await cargar();
    } finally {
      setEliminandoUid(null);
    }
  }

  if (usuario?.rol !== "administrador") {
    return (
      <div className="p-4 md:p-8">
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  const ROL_LABEL: Record<Rol, string> = {
    administrador: "Administrador", coordinador: "Coordinador", director: "Director",
    profesor: "Profesor Supervisor", centro_dual: "Centro Dual", estudiante: "Estudiante",
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold">Usuarios</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">{usuarios.length} usuario(s) en el sistema</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => sincronizar(false)}
            disabled={sincronizando}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 hover:border-blue-500/50 transition-colors"
          >
            <RefreshCw size={15} className={sincronizando ? "animate-spin" : ""} />
            Sincronizar con Firebase
          </button>
          <button onClick={() => { setForm(EMPTY); setModal(true); }} style={{ background: "var(--accent-blue)" }} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            + Crear usuario
          </button>
        </div>
      </div>

      {avisoSync && <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">{avisoSync}</p>}

      {huerfanos.length > 0 && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }} className="rounded-2xl p-4 mb-4">
          <p style={{ color: "var(--warning)" }} className="text-sm font-semibold mb-3">
            Cuentas creadas directo en Firebase, sin ficha en SIGEDUAL todavía:
          </p>
          <div className="flex flex-col gap-2">
            {huerfanos.map((h) => (
              <div key={h.uid} className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--text-primary)" }} className="text-sm truncate">{h.email}</span>
                <button
                  onClick={() => { setHuerfanoActivo(h); setFormHuerfano(EMPTY_HUERFANO); }}
                  style={{ background: "var(--warning)", color: "#1a1300" }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
                >
                  Completar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-4">Cargando...</p>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl overflow-hidden overflow-x-auto mt-4">
          <table className="w-full text-sm min-w-[780px]">
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
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleActivo(u)} style={{ color: u.activo ? "var(--danger)" : "var(--success)" }} className="text-xs hover:underline">
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => eliminarUsuario(u)}
                        disabled={eliminandoUid === u.uid}
                        style={{ color: "var(--danger)" }}
                        className="disabled:opacity-40"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-5 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
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

      {huerfanoActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="w-full max-w-md rounded-2xl p-5 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Completar ficha</h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-6">{huerfanoActivo.email}</p>
            <div className="flex flex-col gap-4">
              {[
                { key: "nombre", label: "Nombre completo", placeholder: "María González" },
                { key: "especialidad", label: "Especialidad (si aplica)", placeholder: "Contabilidad" },
                { key: "liceoId", label: "ID del liceo", placeholder: usuario?.liceoId },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">{label}</label>
                  <input type="text" value={(formHuerfano as Record<string, string>)[key]} onChange={(e) => setFormHuerfano((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors" />
                </div>
              ))}
              <div>
                <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Rol</label>
                <select value={formHuerfano.rol} onChange={(e) => setFormHuerfano((f) => ({ ...f, rol: e.target.value as Rol }))}
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setHuerfanoActivo(null)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={completarHuerfano} disabled={guardandoHuerfano || !formHuerfano.nombre.trim()} style={{ background: "var(--accent-blue)" }} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50">
                {guardandoHuerfano ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
