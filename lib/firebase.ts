import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBKbB7x77RR0Rh6Wj87Eb-31eWqSbiRph8",
  authDomain: "sigedualpeo.firebaseapp.com",
  projectId: "sigedualpeo",
  storageBucket: "sigedualpeo.firebasestorage.app",
  messagingSenderId: "715252128995",
  appId: "1:715252128995:web:1d9a6cd29a8840de3c39d6",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Por defecto el SDK reintenta una subida hasta 2 minutos antes de
// rendirse. Cuando la causa es de configuración (CORS del bucket,
// almacenamiento no habilitado) esos reintentos nunca van a funcionar, y
// lo único que consiguen es dejar al usuario mirando un "0%" sin
// información durante dos minutos. Con un margen más corto el error real
// aparece pronto y se puede actuar; un corte de red genuino se reintenta
// igual, solo que se rinde antes.
storage.maxUploadRetryTime = 20_000;
storage.maxOperationRetryTime = 15_000;
export default app;
