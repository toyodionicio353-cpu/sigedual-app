"use client";
import { X, MapPin, Users, Calendar, Briefcase, GraduationCap, AlertTriangle } from "lucide-react";
import { COLOR_CENTRO, COLOR_PRACTICA, ETIQUETA_CENTRO, ETIQUETA_PRACTICA } from "@/lib/mapa/estados";
import type { PinMapa } from "@/lib/mapa/useDatosMapa";

/** Fecha legible; devuelve "—" si no hay dato utilizable, en vez de una
 * fecha inventada o un "Invalid Date". */
function fecha(valor?: string): string {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span style={{ color: "var(--text-muted)" }}>{etiqueta}</span>
      <span style={{ color: "var(--text-primary)" }} className="text-right font-medium">{valor}</span>
    </div>
  );
}

/**
 * Ficha del elemento seleccionado. El color del estado se usa solo como
 * borde lateral, punto e insignia — nunca se pinta la tarjeta completa,
 * que volvería ilegible el texto y gritaría más que la información.
 *
 * Es de consulta: desde acá no se edita, asigna ni da de baja nada.
 */
export default function FichaMapa({ pin, onCerrar }: { pin: PinMapa; onCerrar: () => void }) {
  const color = pin.tipo === "centro" ? COLOR_CENTRO[pin.estado] : COLOR_PRACTICA;

  return (
    <div
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: `4px solid ${color}` }}
      className="rounded-xl p-4 shadow-xl flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider">
            {pin.tipo === "centro" ? "Formación Dual" : "Práctica Profesional"}
          </p>
          <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-bold leading-snug">
            {pin.tipo === "centro" ? pin.centro.nombre : pin.practica.lugarNombre}
          </h3>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar ficha" style={{ color: "var(--text-muted)" }} className="p-1 flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          style={{ background: `${color}22`, color }}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
        >
          <span style={{ background: color, width: 7, height: 7, borderRadius: "50%" }} />
          {pin.tipo === "centro" ? ETIQUETA_CENTRO[pin.estado] : ETIQUETA_PRACTICA[pin.estado]}
        </span>
        {pin.tipo === "centro" && pin.esNuevo && (
          <span
            style={{ border: "1.5px solid #9333EA", color: "#9333EA" }}
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
          >
            Centro nuevo · período de prueba
          </span>
        )}
      </div>

      <p style={{ color: "var(--text-secondary)" }} className="text-xs flex items-start gap-1.5">
        <MapPin size={13} className="flex-shrink-0 mt-0.5" />
        <span>
          {pin.tipo === "centro"
            ? [pin.centro.direccion, pin.centro.comuna, pin.centro.region].filter(Boolean).join(", ")
            : [pin.practica.direccion, pin.practica.comuna, pin.practica.region].filter(Boolean).join(", ")}
        </span>
      </p>

      <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3 flex flex-col gap-1.5">
        {pin.tipo === "centro" ? (
          <>
            {pin.centro.rut && <Dato etiqueta="Código de registro" valor={pin.centro.rut} />}
            <Dato etiqueta="Capacidad" valor={pin.capacidad.total !== null ? String(pin.capacidad.total) : "Sin registrar"} />
            <Dato etiqueta="Estudiantes asignados" valor={String(pin.capacidad.ocupados)} />
            <Dato etiqueta="Cupos" valor={pin.capacidad.descripcion} />
          </>
        ) : (
          <>
            {pin.estudiante && <Dato etiqueta="Estudiante" valor={pin.estudiante.nombre} />}
            {pin.estudiante && <Dato etiqueta="Curso / nivel" valor={[pin.estudiante.nivel, pin.estudiante.curso].filter(Boolean).join(" · ") || "—"} />}
            <Dato etiqueta="Inicio" valor={fecha(pin.practica.fechaInicio)} />
            <Dato etiqueta="Término" valor={fecha(pin.practica.fechaTermino)} />
          </>
        )}
        <Dato etiqueta="Coordenadas" valor={`${pin.punto.lat.toFixed(5)}, ${pin.punto.lng.toFixed(5)}`} />
      </div>

      {pin.tipo === "practica" && pin.practica.motivoAtencion && (
        <p style={{ color: "var(--warning)" }} className="text-xs flex items-start gap-1.5">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{pin.practica.motivoAtencion}</span>
        </p>
      )}

      {pin.tipo === "centro" && pin.estudiantes.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3">
          <p style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users size={11} /> Estudiantes
          </p>
          <ul className="flex flex-col gap-1.5">
            {pin.estudiantes.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-xs">
                <span style={{ color: "var(--text-primary)" }} className="truncate">{e.nombre}</span>
                <span style={{ color: "var(--text-muted)" }} className="flex-shrink-0">
                  {[e.nivel, e.curso].filter(Boolean).join(" · ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pin.tipo === "centro" && pin.estado === "critico" && (
        <p style={{ color: "var(--danger)" }} className="text-xs flex items-start gap-1.5">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>Este centro está inactivo pero todavía tiene estudiantes asignados.</span>
        </p>
      )}

      <p style={{ color: "var(--text-muted)" }} className="text-[10px] flex items-center gap-1.5">
        {pin.tipo === "centro" ? <Briefcase size={10} /> : <GraduationCap size={10} />}
        <Calendar size={10} />
        Los datos se editan desde su ficha, no desde el mapa.
      </p>
    </div>
  );
}
