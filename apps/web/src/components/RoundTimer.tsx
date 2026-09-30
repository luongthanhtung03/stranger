"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EXTEND_PROMPT_MS, ROUND_MS } from "@stranger/shared";

const R = 20;
const C = 2 * Math.PI * R;

export function RoundTimer({ endsAt, total = ROUND_MS }: { endsAt: number; total?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, endsAt - now);
  const frac = Math.min(1, left / total);
  const urgent = left <= EXTEND_PROMPT_MS;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);

  return (
    <motion.div
      animate={urgent ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 1, repeat: Infinity } : {}}
      className="glass flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3"
    >
      <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90">
        <circle cx="23" cy="23" r={R} stroke="rgba(255,255,255,.12)" strokeWidth="4" fill="none" />
        <circle
          cx="23"
          cy="23"
          r={R}
          stroke={urgent ? "#ec4899" : "#a78bfa"}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{ transition: "stroke-dashoffset .25s linear, stroke .3s" }}
        />
      </svg>
      <span className={`text-sm font-bold tabular-nums ${urgent ? "text-accent-2" : ""}`}>
        {m}:{s.toString().padStart(2, "0")}
      </span>
    </motion.div>
  );
}
