"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePlanesComerciales } from "@/lib/planesComerciales/usePlanesComerciales";
import { useCaracteristicasComerciales } from "@/lib/planesComerciales/useCaracteristicasComerciales";
import { crearPlan, actualizarPlan, actualizarCaracteristicas, type DatosPlanFormulario } from "@/lib/planesComerciales/gestionarPlanes";
import { formatearCLP, ETIQUETA_PERIODICIDAD, ETIQUETA_ESTADO_PLAN } from "@/lib/planesComerciales";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";
import type { EstadoPlanComercial, PeriodicidadPlan, PlanComercial } from "@/types";
import { Plus, Pencil, Star, ListChecks, X } from "lucide-react";

const OPCIONES_PERIODICIDAD = [
  { value: "mensual", label: "Mensual" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];
const OPCIONES_ESTADO = [
  { value: "activo", label: "Activo" },
  { value: "proximamente", label: "Próximamente" },
  { value: "inactivo", label: "Inactivo" },
  { value: "suspendido", label: "Suspendido" },
];

const FORM_VACIO: DatosPlanFormulario = {
  nombre: "", periodicidad: "mensual", precio: 0, descripcion: "",
  estado: "proximamente", recomendado: false, orden: 0, textoDestacado: "", informacionAdicional: "",
};

function FormularioPlan({ inicial, onCancelar, onGuardar, guardando }: {
  inicial: DatosPlanFormulario;
  onCancelar: () => void;
  onGuardar: (datos: DatosPlanFormulario) => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<DatosPlanFormulario>(inicial);

  function set<K extends keyof DatosPlanFormulario>(campo: K, valor: DatosPlanFormulario[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onCancelar}>
      <div
        role="dialog" aria-modal="true" aria-label="Plan comercial"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold">Plan comercial</h2>
          <button onClick={onCancelar} style={{ color: "var(--text-muted)" }} className="p-1 hover:[color:var(--text-primary)]"><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Nombre del plan</label>
            <input
              value={form.nombre} onChange={(e) => set("nombre", e.target.value)}
              placeholder="SIGEDUAL Mensual"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Período</label>
              <Select value={form.periodicidad} onChange={(v) => set("periodicidad", v as PeriodicidadPlan)} ariaLabel="Período" opciones={OPCIONES_PERIODICIDAD} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Precio (CLP)</label>
              <input
                type="number" min={0} value={form.precio}
                onChange={(e) => set("precio", Number(e.target.value))}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Descripción corta</label>
            <input
              value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)}
              placeholder="Acceso a SIGEDUAL durante un mes."
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)]"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Texto destacado (opcional)</label>
            <input
              value={form.textoDestacado} onChange={(e) => set("textoDestacado", e.target.value)}
              placeholder="Ej: Ahorra pagando semestral"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)]"
            />
          </div>

          <div>
            <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Información comercial adicional (opcional)</label>
            <textarea
              value={form.informacionAdicional} onChange={(e) => set("informacionAdicional", e.target.value)}
              rows={2}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Estado</label>
              <Select value={form.estado} onChange={(v) => set("estado", v as EstadoPlanComercial)} ariaLabel="Estado" opciones={OPCIONES_ESTADO} />
            </div>
            <div>
              <label style={{ color: "var(--text-secondary)" }} className="block text-xs mb-1">Orden de aparición</label>
              <input
                type="number" value={form.orden} onChange={(e) => set("orden", Number(e.target.value))}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--text-primary)" }} className="text-sm font-medium">Mostrar como "Recomendado"</span>
            <Switch checked={form.recomendado} onChange={(v) => set("recomendado", v)} label="Mostrar como recomendado" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onCancelar} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="flex-1 py-2.5 rounded-xl text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={() => onGuardar(form)}
            disabled={guardando || !form.nombre.trim()}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SeccionCaracteristicas({ adminUid, adminNombre }: { adminUid: string; adminNombre: string }) {
  const { items, cargando, recargar } = useCaracteristicasComerciales();
  const [lista, setLista] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setLista(items); }, [items]);

  function agregar() {
    const texto = nuevo.trim();
    if (!texto) return;
    setLista((l) => [...l, texto]);
    setNuevo("");
  }
  function quitar(i: number) {
    setLista((l) => l.filter((_, idx) => idx !== i));
  }
  async function guardar() {
    setGuardando(true);
    try {
      await actualizarCaracteristicas(lista, adminUid, adminNombre);
      await recargar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 sm:p-5 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <ListChecks size={16} style={{ color: "var(--accent-light)" }} />
        <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">¿Qué incluye SIGEDUAL?</h3>
      </div>
      <p style={{ color: "var(--text-secondary)" }} className="text-xs mb-3">
        Lista compartida por los tres planes — son el mismo servicio, solo cambia el período.
      </p>

      {cargando ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 mb-3">
            {lista.map((item, i) => (
              <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg">
                <span style={{ color: "var(--text-primary)" }} className="text-sm">{item}</span>
                <button onClick={() => quitar(i)} style={{ color: "var(--text-muted)" }} className="hover:[color:var(--danger)]"><X size={14} /></button>
              </div>
            ))}
            {lista.length === 0 && <p style={{ color: "var(--text-muted)" }} className="text-xs">Todavía no hay características configuradas.</p>}
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={nuevo} onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
              placeholder="Ej: Gestión de estudiantes"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-light)", color: "var(--text-primary)" }}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none focus:[border-color:var(--accent)]"
            />
            <button onClick={agregar} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }} className="px-3 py-2 rounded-lg text-sm font-medium">
              Agregar
            </button>
          </div>
          <button
            onClick={guardar} disabled={guardando}
            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar lista"}
          </button>
        </>
      )}
    </div>
  );
}

export default function GestionPlanesComerciales() {
  const { usuario } = useAuth();
  const { planes, cargando, recargar } = usePlanesComerciales();
  const [formulario, setFormulario] = useState<{ modo: "crear" } | { modo: "editar"; plan: PlanComercial } | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!usuario || usuario.rol !== "administrador") {
    return (
      <div>
        <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Planes SIGEDUAL</h2>
        <p style={{ color: "var(--danger)" }} className="text-sm">Acceso denegado.</p>
      </div>
    );
  }

  async function guardar(datos: DatosPlanFormulario) {
    if (!usuario) return;
    setGuardando(true);
    try {
      if (formulario?.modo === "editar") {
        await actualizarPlan(formulario.plan.id, datos, usuario.uid, usuario.nombre);
      } else {
        await crearPlan(datos, usuario.uid, usuario.nombre);
      }
      await recargar();
      setFormulario(null);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-1">
        <div>
          <h2 style={{ color: "var(--text-primary)" }} className="text-lg font-bold mb-1">Planes SIGEDUAL</h2>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mb-4">
            Precios, períodos y estado de la sección comercial. El sistema de pagos permanece
            desactivado: esto solo controla qué se muestra en <code>/planes</code>.
          </p>
        </div>
        <button
          onClick={() => setFormulario({ modo: "crear" })}
          style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus size={16} />
          Agregar plan
        </button>
      </div>

      {cargando ? (
        <p style={{ color: "var(--text-secondary)" }} className="text-sm">Cargando...</p>
      ) : planes.length === 0 ? (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-8 text-center">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold mb-1">Todavía no hay planes configurados.</p>
          <p style={{ color: "var(--text-secondary)" }} className="text-xs">Usa "Agregar plan" para crear Mensual, Semestral y Anual.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {planes.map((plan) => (
            <div key={plan.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold truncate">{plan.nombre}</p>
                  {plan.recomendado && (
                    <span style={{ background: "var(--accent)22", color: "var(--accent-light)" }} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      <Star size={10} /> Recomendado
                    </span>
                  )}
                </div>
                <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                  {ETIQUETA_PERIODICIDAD[plan.periodicidad]} · {formatearCLP(plan.precio)} · {ETIQUETA_ESTADO_PLAN[plan.estado]} · orden {plan.orden}
                </p>
              </div>
              <button
                onClick={() => setFormulario({ modo: "editar", plan })}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:[border-color:var(--accent)] transition-colors flex-shrink-0"
              >
                <Pencil size={13} />
                Editar
              </button>
            </div>
          ))}
        </div>
      )}

      <SeccionCaracteristicas adminUid={usuario.uid} adminNombre={usuario.nombre} />

      {formulario && (
        <FormularioPlan
          inicial={formulario.modo === "editar" ? {
            nombre: formulario.plan.nombre, periodicidad: formulario.plan.periodicidad, precio: formulario.plan.precio,
            descripcion: formulario.plan.descripcion, estado: formulario.plan.estado, recomendado: formulario.plan.recomendado,
            orden: formulario.plan.orden, textoDestacado: formulario.plan.textoDestacado ?? "", informacionAdicional: formulario.plan.informacionAdicional ?? "",
          } : FORM_VACIO}
          onCancelar={() => setFormulario(null)}
          onGuardar={guardar}
          guardando={guardando}
        />
      )}
    </div>
  );
}
