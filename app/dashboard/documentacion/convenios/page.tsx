export default function ConveniosPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: "rgba(251,191,36,0.12)", border: "1px solid #fbbf2440",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
      }}>
        <i className="fa-solid fa-handshake" style={{ color: "#fbbf24", fontSize: 22 }} />
      </div>
      <p style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>Convenios</p>
      <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>Se habilitará próximamente</p>
    </div>
  );
}
