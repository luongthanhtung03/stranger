const PALETTE = [
  ["#7c3aed", "#ec4899"],
  ["#06b6d4", "#3b82f6"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#06b6d4"],
  ["#8b5cf6", "#06b6d4"],
  ["#f43f5e", "#f59e0b"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, size = 56, className = "" }: { name: string; size?: number; className?: string }) {
  const [a, b] = PALETTE[hash(name || "?") % PALETTE.length];
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundImage: `linear-gradient(135deg, ${a}, ${b})`,
        boxShadow: `0 8px 30px -8px ${a}aa`,
      }}
    >
      {initial}
    </div>
  );
}
