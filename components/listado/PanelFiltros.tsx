/** Contenedor visual del panel de filtros colapsable, compartido por los
 * listados principales de SIGEDUAL. El contenido (los `<Select>` propios
 * de cada módulo) se pasa como children porque los campos de filtro son
 * distintos por entidad. */
export default function PanelFiltros({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} className="rounded-2xl p-4 sm:p-5 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </div>
  );
}
