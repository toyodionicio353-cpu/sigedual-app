"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <div style={{ background: "var(--bg-base)" }} className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 style={{ color: "var(--accent-blue-light)" }} className="text-3xl font-bold">SIGEDUAL</h1>
        <p style={{ color: "var(--text-secondary)" }} className="mt-2">Cargando...</p>
      </div>
    </div>
  );
}
