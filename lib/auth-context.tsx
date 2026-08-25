"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Usuario } from "@/types";

interface AuthContextType {
  user: User | null;
  usuario: Usuario | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, usuario: null, loading: true });

// Detecta browser/SO básico desde userAgent
function detectarDispositivo() {
  if (typeof navigator === "undefined") return {};
  const ua = navigator.userAgent;
  let so = "Desconocido";
  let browser = "Desconocido";
  if (/Windows/i.test(ua))      so = "Windows";
  else if (/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) so = "macOS";
  else if (/iPhone/i.test(ua))  so = "iOS";
  else if (/iPad/i.test(ua))    so = "iPadOS";
  else if (/Android/i.test(ua)) so = "Android";
  else if (/Linux/i.test(ua))   so = "Linux";
  if (/Edg\//i.test(ua))        browser = "Edge";
  else if (/Chrome/i.test(ua))  browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua))  browser = "Safari";
  return { so, browser };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sesionId: string | null = null;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Busca el documento del usuario por UID o por email
        let snap = await getDoc(doc(db, "usuarios", firebaseUser.uid));
        let userData: Usuario | null = null;

        if (snap.exists()) {
          userData = snap.data() as Usuario;
        } else {
          // Busca por email (usuarios creados desde el admin panel)
          const q = query(collection(db,"usuarios"), where("email","==",firebaseUser.email));
          const result = await getDocs(q);
          if (!result.empty) userData = result.docs[0].data() as Usuario;
        }

        setUsuario(userData);

        // Registra sesión en Firestore
        try {
          const { so, browser } = detectarDispositivo();
          sesionId = firebaseUser.uid + "_" + Date.now();
          await setDoc(doc(db, "sesiones", sesionId), {
            uid:        firebaseUser.uid,
            nombre:     userData?.nombre ?? firebaseUser.displayName ?? "Usuario",
            email:      firebaseUser.email ?? "",
            rol:        userData?.rol ?? "estudiante",
            liceoId:    userData?.liceoId ?? "",
            so,
            browser,
            dispositivo: so === "Windows" ? "PC" : so === "macOS" ? "Mac" : so,
            iniciadoEn: serverTimestamp(),
            ultimaAct:  serverTimestamp(),
          });
        } catch(err) { console.error("[SIGEDUAL] Error registrando sesión en Firestore:", err); }

      } else {
        // Al cerrar sesión, elimina el registro de sesión y registra logout
        if (sesionId) {
          try { await deleteDoc(doc(db,"sesiones",sesionId)); } catch {}
          sesionId = null;
        }
        setUsuario(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  return <AuthContext.Provider value={{ user, usuario, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
