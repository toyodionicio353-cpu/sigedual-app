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
export default app;
