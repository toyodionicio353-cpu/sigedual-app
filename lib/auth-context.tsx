"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Usuario } from "@/types";

interface LiceoActivo {
  id: string;
  nombre: string;
}

const CLAVE_LICEO_ACTIVO = "sigedual_liceo_activo";

interface AuthContextType {
  user: User | null;
  /** Usuario efectivo: si un administrador entró a un liceo, su liceoId queda reemplazado por el de ese liceo. */
  usuario: Usuario | null;
  /** Usuario real, sin el reemplazo de liceoId — para saber quién es de verdad (ej. mostrar su rol real). */
  usuarioReal: Usuario | null;
  liceoActivo: LiceoActivo | null;
  entrarALiceo: (liceo: LiceoActivo) => void;
  salirDelLiceo: () => void;
  /** Vuelve a leer el documento de usuarios/{uid} — usarlo tras editar el propio perfil,
   * para que el resto de la app (encabezado, sidebar, etc.) refleje los cambios sin recargar. */
  refrescarUsuario: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, usuario: null, usuarioReal: null, liceoActivo: null,
  entrarALiceo: () => {}, salirDelLiceo: () => {}, refrescarUsuario: async () => {}, loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuarioReal, setUsuarioReal] = useState<Usuario | null>(null);
  const [liceoActivo, setLiceoActivo] = useState<LiceoActivo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "usuarios", firebaseUser.uid));
        const datosUsuario = snap.exists() ? (snap.data() as Usuario) : null;
        setUsuarioReal(datosUsuario);
        if (datosUsuario?.rol === "administrador") {
          const guardado = sessionStorage.getItem(CLAVE_LICEO_ACTIVO);
          if (guardado) {
            try {
              setLiceoActivo(JSON.parse(guardado) as LiceoActivo);
            } catch {
              sessionStorage.removeItem(CLAVE_LICEO_ACTIVO);
            }
          }
        } else {
          setLiceoActivo(null);
          sessionStorage.removeItem(CLAVE_LICEO_ACTIVO);
        }
      } else {
        setUsuarioReal(null);
        setLiceoActivo(null);
        sessionStorage.removeItem(CLAVE_LICEO_ACTIVO);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function entrarALiceo(liceo: LiceoActivo) {
    setLiceoActivo(liceo);
    sessionStorage.setItem(CLAVE_LICEO_ACTIVO, JSON.stringify(liceo));
  }

  function salirDelLiceo() {
    setLiceoActivo(null);
    sessionStorage.removeItem(CLAVE_LICEO_ACTIVO);
  }

  async function refrescarUsuario() {
    if (!user) return;
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (snap.exists()) setUsuarioReal(snap.data() as Usuario);
  }

  const usuario: Usuario | null =
    usuarioReal?.rol === "administrador" && liceoActivo
      ? { ...usuarioReal, liceoId: liceoActivo.id }
      : usuarioReal;

  return (
    <AuthContext.Provider value={{ user, usuario, usuarioReal, liceoActivo, entrarALiceo, salirDelLiceo, refrescarUsuario, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
