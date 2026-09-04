import type { Rol } from "@/types";

export interface Comando {
  id: string;
  etiqueta: string;
  href?: string;
  accion?: "cerrar-sesion";
  roles: Rol[];
  categoria: string;
}

const TODOS: Rol[] = ["administrador", "coordinador", "director", "profesor", "centro_dual", "estudiante"];

// Lista curada de destinos y acciones para la paleta de comandos (Ctrl/Cmd+K).
// No reemplaza al Sidebar (fuente de verdad de la navegación): es un atajo
// hacia los mismos destinos, filtrado por rol igual que el menú lateral.
export const COMANDOS: Comando[] = [
  { id: "dashboard", etiqueta: "Ir al Dashboard", href: "/dashboard", roles: TODOS, categoria: "Navegación" },
  { id: "estudiantes", etiqueta: "Ir a Estudiantes", href: "/dashboard/estudiantes", roles: ["administrador", "coordinador", "director", "profesor"], categoria: "Navegación" },
  { id: "estudiante-nuevo", etiqueta: "Agregar estudiante", href: "/dashboard/estudiantes/nuevo", roles: ["administrador", "profesor"], categoria: "Acciones" },
  { id: "asignaciones", etiqueta: "Ver asignaciones", href: "/dashboard/estudiantes/asignaciones", roles: ["administrador", "coordinador", "director", "profesor"], categoria: "Navegación" },
  { id: "centros", etiqueta: "Buscar centro dual", href: "/dashboard/centros", roles: ["administrador", "coordinador", "director", "profesor", "centro_dual"], categoria: "Navegación" },
  { id: "centro-nuevo", etiqueta: "Agregar centro", href: "/dashboard/centros/nuevo", roles: ["administrador", "profesor"], categoria: "Acciones" },
  { id: "profesores", etiqueta: "Ir a Profesores", href: "/dashboard/profesores", roles: ["administrador", "coordinador", "director"], categoria: "Navegación" },
  { id: "especialidades", etiqueta: "Ir a Especialidades", href: "/dashboard/especialidades", roles: ["administrador", "coordinador", "director"], categoria: "Navegación" },
  { id: "documentos-convenios", etiqueta: "Abrir Convenios", href: "/dashboard/documentos/convenios", roles: TODOS, categoria: "Documentos" },
  { id: "documentos-evaluaciones", etiqueta: "Crear evaluación", href: "/dashboard/documentos/evaluaciones", roles: TODOS, categoria: "Documentos" },
  { id: "documentos", etiqueta: "Abrir Documentos", href: "/dashboard/documentos/documentos", roles: TODOS, categoria: "Documentos" },
  { id: "mensajes", etiqueta: "Abrir Mensajes", href: "/dashboard/mensajes", roles: TODOS, categoria: "Navegación" },
  { id: "usuarios", etiqueta: "Buscar usuarios", href: "/dashboard/usuarios", roles: ["administrador"], categoria: "Administración" },
  { id: "liceos", etiqueta: "Ir a Liceos", href: "/dashboard/liceos", roles: ["administrador"], categoria: "Administración" },
  { id: "configuracion", etiqueta: "Abrir Configuración", href: "/dashboard/administracion/configuracion", roles: TODOS, categoria: "Administración" },
  { id: "soporte", etiqueta: "Ir a Soporte", href: "/dashboard/soporte", roles: TODOS, categoria: "Navegación" },
  { id: "cerrar-sesion", etiqueta: "Cerrar sesión", accion: "cerrar-sesion", roles: TODOS, categoria: "Cuenta" },
];
