export default function TituloPagina({
  icon, children, className,
}: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <h1
      style={{ color: "var(--text-primary)" }}
      className={`text-3xl font-bold flex items-center gap-3 ${className ?? ""}`}
    >
      <span style={{ color: "var(--accent)" }} className="flex-shrink-0 flex items-center">{icon}</span>
      {children}
    </h1>
  );
}
