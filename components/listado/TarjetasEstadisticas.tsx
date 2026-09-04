export interface EstadisticaListado {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

/** Grid de tarjetas KPI compartido por los listados principales de
 * SIGEDUAL. Mientras `loading` es true, muestra "—" en vez del valor. */
export default function TarjetasEstadisticas({
  estadisticas, loading,
}: {
  estadisticas: EstadisticaListado[];
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {estadisticas.map((s) => (
        <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }} className="p-4 flex flex-col gap-3">
          <div style={{ background: "var(--accent)", borderRadius: 999 }} className="w-9 h-9 flex items-center justify-center">
            <span style={{ color: "var(--text-on-accent)" }}>{s.icon}</span>
          </div>
          <div>
            <p style={{ color: "var(--text-primary)" }} className="text-lg font-bold leading-tight">{loading ? "—" : s.value}</p>
            <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
