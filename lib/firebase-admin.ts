import { createSign } from "crypto";

const FIREBASE_API_KEY = "AIzaSyBKbB7x77RR0Rh6Wj87Eb-31eWqSbiRph8";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function getServiceAccount(): ServiceAccount {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!json) {
    throw new Error(
      "Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY en el servidor (Vercel > Settings > Environment Variables)."
    );
  }
  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no es un JSON válido. Revisa que se haya copiado el archivo completo.");
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no tiene los campos esperados (project_id, client_email, private_key).");
  }
  return parsed as ServiceAccount;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signJwt(sa: ServiceAccount, scope: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key);
  return `${unsigned}.${base64url(signature)}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const sa = getServiceAccount();
  const assertion = signJwt(sa, "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo autenticar con Google (revisa la clave de servicio): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

/**
 * Verifica que la petición traiga un token de Firebase válido y que el
 * usuario correspondiente tenga rol "administrador". Lanza un Error con
 * el mensaje adecuado si no se cumple. Devuelve el uid del solicitante.
 */
export async function requireAdmin(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) throw new Error("No autorizado: falta el token de sesión.");

  const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!lookupRes.ok) throw new Error("No autorizado: token inválido o vencido.");
  const lookupData = (await lookupRes.json()) as { users?: { localId: string }[] };
  const uid = lookupData.users?.[0]?.localId;
  if (!uid) throw new Error("No autorizado: token inválido.");

  const sa = getServiceAccount();
  const docRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/usuarios/${uid}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  if (!docRes.ok) throw new Error("No autorizado: no se encontró tu ficha de usuario.");
  const doc = (await docRes.json()) as { fields?: { rol?: { stringValue?: string } } };
  if (doc.fields?.rol?.stringValue !== "administrador") {
    throw new Error("No autorizado: se requiere rol de administrador.");
  }
  return uid;
}

/**
 * Verifica que la petición traiga un token de Firebase válido, sin exigir
 * ningún rol — cada ruta decide qué autorización adicional necesita.
 * Devuelve el uid del solicitante.
 */
export async function requireCallerUid(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) throw new Error("No autorizado: falta el token de sesión.");

  const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!lookupRes.ok) throw new Error("No autorizado: token inválido o vencido.");
  const lookupData = (await lookupRes.json()) as { users?: { localId: string }[] };
  const uid = lookupData.users?.[0]?.localId;
  if (!uid) throw new Error("No autorizado: token inválido.");
  return uid;
}

/** Todas las cuentas (uid + correo) que existen actualmente en Firebase Authentication. */
export async function listAuthAccounts(): Promise<{ uid: string; email: string }[]> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  const cuentas: { uid: string; email: string }[] = [];
  let nextPageToken: string | undefined;
  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:batchGet`);
    url.searchParams.set("maxResults", "1000");
    if (nextPageToken) url.searchParams.set("nextPageToken", nextPageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`No se pudo listar usuarios de Firebase Auth: ${await res.text()}`);
    const data = (await res.json()) as { users?: { localId: string; email?: string }[]; nextPageToken?: string };
    (data.users ?? []).forEach((u) => cuentas.push({ uid: u.localId, email: u.email ?? "" }));
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);
  return cuentas;
}

/** Todos los uid que existen como documento en Firestore "usuarios". */
export async function listFirestoreUsuarioIds(): Promise<string[]> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/usuarios`);
    url.searchParams.set("pageSize", "300");
    url.searchParams.set("mask.fieldPaths", "uid");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`No se pudo leer Firestore: ${await res.text()}`);
    const data = (await res.json()) as { documents?: { name: string }[]; nextPageToken?: string };
    (data.documents ?? []).forEach((d) => ids.push(d.name.split("/").pop() as string));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

export async function deleteFirestoreUsuario(uid: string): Promise<void> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/usuarios/${uid}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function deleteAuthUser(uid: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ localId: uid }),
  });
  if (!res.ok) {
    const texto = await res.text();
    if (!texto.includes("USER_NOT_FOUND")) {
      throw new Error(`No se pudo eliminar la cuenta en Firebase Auth: ${texto}`);
    }
  }
}

type FirestoreValue = Record<string, unknown>;

function jsToFirestoreValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(jsToFirestoreValue) } };
  if (typeof v === "object") {
    const fields = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, jsToFirestoreValue(val)]));
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function firestoreValueToJs(v: FirestoreValue | undefined): unknown {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) {
    const values = (v.arrayValue as { values?: FirestoreValue[] })?.values ?? [];
    return values.map(firestoreValueToJs);
  }
  if ("mapValue" in v) {
    const fields = (v.mapValue as { fields?: Record<string, FirestoreValue> })?.fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([k, val]) => [k, firestoreValueToJs(val)]));
  }
  return null;
}

/** Lee todos los documentos de una colección de nivel raíz, con todos sus campos. */
export async function listCollectionDocs(collectionPath: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  const out: { id: string; data: Record<string, unknown> }[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${collectionPath}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`No se pudo leer ${collectionPath}: ${await res.text()}`);
    const data = (await res.json()) as { documents?: { name: string; fields?: Record<string, FirestoreValue> }[]; nextPageToken?: string };
    (data.documents ?? []).forEach((d) => {
      const id = d.name.split("/").pop() as string;
      const fields = d.fields ?? {};
      const obj = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, firestoreValueToJs(v)]));
      out.push({ id, data: obj });
    });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

/** Lee un único documento por ruta (ej: "invitaciones/abc123"). Devuelve `null` si no existe. */
export async function getDocument(path: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo leer ${path}: ${await res.text()}`);
  const doc = (await res.json()) as { name: string; fields?: Record<string, FirestoreValue> };
  const id = doc.name.split("/").pop() as string;
  const fields = doc.fields ?? {};
  const data = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, firestoreValueToJs(v)]));
  return { id, data };
}

/** Actualiza solo los campos indicados de un documento existente (Firestore REST `updateMask`). */
export async function updateDocumentFields(path: string, data: Record<string, unknown>): Promise<void> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, jsToFirestoreValue(v)]));
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}?${mask}`,
    { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fields }) }
  );
  if (!res.ok) throw new Error(`No se pudo actualizar ${path}: ${await res.text()}`);
}

/** Crea un documento nuevo con ID autogenerado en la colección indicada (ej: "notificaciones"). Devuelve el ID creado. */
export async function addDocument(collectionPath: string, data: Record<string, unknown>): Promise<string> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, jsToFirestoreValue(v)]));
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${collectionPath}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fields }) }
  );
  if (!res.ok) throw new Error(`No se pudo crear el documento en ${collectionPath}: ${await res.text()}`);
  const doc = (await res.json()) as { name: string };
  return doc.name.split("/").pop() as string;
}

/** Crea o reemplaza por completo un documento en la ruta indicada (ej: "estudiantes_archivados/abc123"). */
export async function setDocument(path: string, data: Record<string, unknown>): Promise<void> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, jsToFirestoreValue(v)]));
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}`,
    { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fields }) }
  );
  if (!res.ok) throw new Error(`No se pudo escribir ${path}: ${await res.text()}`);
}

/** Elimina un documento en la ruta indicada (ej: "estudiantes/abc123"). */
export async function deleteDocument(path: string): Promise<void> {
  const sa = getServiceAccount();
  const token = await getAccessToken();
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${path}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`No se pudo eliminar ${path}: ${await res.text()}`);
}
