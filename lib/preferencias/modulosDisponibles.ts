// Lista canónica de módulos personalizables del Dashboard (debe usar los
// mismos `id` que app/dashboard/page.tsx). Centralizada aquí para que la
// UI de "Personalizar Dashboard" en Configuración no dependa de duplicar
// la lista de tarjetas del Dashboard.
export const MODULOS_DASHBOARD_DISPONIBLES = [
  { id: "estudiantes", label: "Estudiantes" },
  { id: "centros", label: "Centros Duales" },
  { id: "profesores", label: "Profesores" },
  { id: "especialidades", label: "Especialidades" },
  { id: "mensajes", label: "Mensajes" },
] as const;
