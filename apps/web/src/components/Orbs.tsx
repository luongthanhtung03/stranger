// Ambient background: three slow-drifting gradient orbs behind the content.
export function Orbs({ dim = false }: { dim?: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-700"
      style={{ opacity: dim ? 0.4 : 1 }}
    >
      <div className="orb orb-a bg-accent" style={{ width: 380, height: 380, top: "-8%", left: "-12%" }} />
      <div className="orb orb-b bg-accent-2" style={{ width: 320, height: 320, top: "35%", right: "-14%" }} />
      <div className="orb orb-c" style={{ width: 300, height: 300, bottom: "-10%", left: "20%", background: "#4f46e5" }} />
    </div>
  );
}
