const API_KEY = "AIzaSyBKbB7x77RR0Rh6Wj87Eb-31eWqSbiRph8";
const PROJECT_ID = "sigedualpeo";
const UID = "Jdsd204O3nc2eNqZmbz83X2i4Mi1"; // ya creado en Auth

// Guardar en Firestore sin auth (modo test)
const firestoreRes = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/usuarios/${UID}?key=${API_KEY}`,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        uid:        { stringValue: UID },
        email:      { stringValue: "admin@sigedual.cl" },
        nombre:     { stringValue: "Administrador SIGEDUAL" },
        rol:        { stringValue: "administrador" },
        especialidad: { stringValue: "" },
        liceoId:    { stringValue: "liceo_principal" },
        activo:     { booleanValue: true },
        creadoEn:   { stringValue: new Date().toISOString() },
      },
    }),
  }
);

const data = await firestoreRes.json();

if (data.error) {
  console.error("❌ Error Firestore:", data.error.message);
  process.exit(1);
}

console.log("✅ Administrador registrado correctamente.\n");
console.log("========================================");
console.log("  Correo:     admin@sigedual.cl");
console.log("  Contraseña: Sigedual2024*");
console.log("  Rol:        Administrador");
console.log("========================================");
