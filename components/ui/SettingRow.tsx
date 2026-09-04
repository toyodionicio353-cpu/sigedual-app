"use client";

interface SettingRowProps {
  id?: string;
  titulo: string;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
  vertical?: boolean; // controles anchos (radio cards, selects largos) van debajo del texto
  badge?: React.ReactNode;
}

export default function SettingRow({ id, titulo, descripcion, children, vertical, badge }: SettingRowProps) {
  return (
    <div
      id={id}
      className={`py-4 first:pt-0 first:border-t-0 last:pb-0 border-t ${vertical ? "flex flex-col gap-3" : "flex items-center justify-between gap-4"}`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className={vertical ? "" : "min-w-0"}>
        <div className="flex items-center gap-2 flex-wrap">
          <p style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">{titulo}</p>
          {badge}
        </div>
        {descripcion && (
          <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-0.5 leading-relaxed">{descripcion}</p>
        )}
      </div>
      <div className={vertical ? "" : "flex-shrink-0"}>{children}</div>
    </div>
  );
}
