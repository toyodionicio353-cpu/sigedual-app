import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!json) {
    throw new Error(
      "Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY en el servidor (Vercel > Settings > Environment Variables)."
    );
  }

  const serviceAccount = JSON.parse(json);
  return initializeApp({ credential: cert(serviceAccount) });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

/**
 * Verifica que la petición venga de un usuario autenticado con rol
 * "administrador" (vía token de Firebase en el header Authorization).
 * Lanza un Error con el mensaje adecuado si no se cumple.
 */
export async function requireAdmin(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("No autorizado: falta el token de sesión.");

  const decoded = await adminAuth().verifyIdToken(token);
  const snap = await adminDb().doc(`usuarios/${decoded.uid}`).get();
  if (!snap.exists || snap.data()?.rol !== "administrador") {
    throw new Error("No autorizado: se requiere rol de administrador.");
  }
  return decoded.uid;
}
