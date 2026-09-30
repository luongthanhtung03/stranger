"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Bida 4 lỗ: pockets in the screen corners, a white cue ball and a pink ball.
// Pull the cue ball back and release to shoot it the opposite way (slingshot).
// Pink in a pocket = +1, cue ball in a pocket = −1 (yes, negative is allowed).
// A pocketed ball reappears somewhere random and play continues.

const R = 19;
const POCKET_R = 34;
const POCKET_INSET = 44;
const MAX_POWER = 1500; // px/s
const DRAG_GAIN = 4.2;
const RESTITUTION = 0.82;
const FRICTION_PER_S = 0.33; // fraction of speed kept after one second
const RESPAWN_MS = 500;

type Kind = "cue" | "pink";
interface Ball {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sunk: boolean;
  spawnedAt: number;
}

const STYLE: Record<Kind, string> = {
  cue: "radial-gradient(circle at 35% 30%, #fff 0%, #f3f0ff 30%, #b8b0d8 75%, #6b6390 100%)",
  pink: "radial-gradient(circle at 35% 30%, #ffd1e8 0%, #ec4899 35%, #9d174d 80%, #4a0a26 100%)",
};

function pockets() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return [
    { x: POCKET_INSET, y: POCKET_INSET },
    { x: w - POCKET_INSET, y: POCKET_INSET },
    { x: POCKET_INSET, y: h - POCKET_INSET },
    { x: w - POCKET_INSET, y: h - POCKET_INSET },
  ];
}

/** Random spot away from the pockets and from the other ball. */
function randomSpot(avoid?: { x: number; y: number }) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < 30; i++) {
    const p = { x: w * 0.15 + Math.random() * w * 0.7, y: h * 0.15 + Math.random() * h * 0.6 };
    if (avoid && Math.hypot(p.x - avoid.x, p.y - avoid.y) < R * 5) continue;
    if (pockets().some((k) => Math.hypot(p.x - k.x, p.y - k.y) < POCKET_R * 3)) continue;
    return p;
  }
  return { x: w / 2, y: h / 2 };
}

export function BilliardsGame({ onScore }: { onScore: (score: number) => void }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const aimRef = useRef<SVGLineElement>(null);
  const stickRef = useRef<SVGLineElement>(null);
  const [sinkFx, setSinkFx] = useState<{ id: number; x: number; y: number; delta: number }[]>([]);
  const balls = useRef<Ball[]>([]);
  const score = useRef(0);

  useEffect(() => {
    if (balls.current.length === 0) {
      const a = randomSpot();
      const b = randomSpot(a);
      balls.current = [
        { kind: "cue", ...a, vx: 0, vy: 0, sunk: false, spawnedAt: performance.now() },
        { kind: "pink", ...b, vx: 0, vy: 0, sunk: false, spawnedAt: performance.now() },
      ];
    }
    let raf = 0;
    let last = performance.now();
    let fxId = 0;
    let drag: { ball: Ball; px: number; py: number } | null = null;

    const onDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement).closest?.("[data-ball]") as HTMLElement | null;
      if (target?.dataset.ball !== "cue") return; // only the cue ball is playable
      const ball = balls.current.find((b) => b.kind === "cue");
      if (!ball || ball.sunk) return;
      drag = { ball, px: e.clientX, py: e.clientY };
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (drag) {
        drag.px = e.clientX;
        drag.py = e.clientY;
      }
    };
    const onUp = () => {
      if (!drag) return;
      const { ball, px, py } = drag;
      // Slingshot: pull back, shoot the other way.
      let vx = (ball.x - px) * DRAG_GAIN;
      let vy = (ball.y - py) * DRAG_GAIN;
      const p = Math.hypot(vx, vy);
      if (p > MAX_POWER) {
        vx *= MAX_POWER / p;
        vy *= MAX_POWER / p;
      }
      if (p > 40) {
        ball.vx = vx;
        ball.vy = vy;
      }
      drag = null;
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    const sink = (b: Ball, at: { x: number; y: number }, now: number) => {
      b.sunk = true;
      b.vx = b.vy = 0;
      const delta = b.kind === "pink" ? 1 : -1;
      score.current += delta;
      onScore(score.current);
      const id = fxId++;
      setSinkFx((f) => [...f, { id, x: at.x, y: at.y, delta }]);
      setTimeout(() => setSinkFx((f) => f.filter((k) => k.id !== id)), 900);
      try {
        navigator.vibrate?.(delta > 0 ? 20 : [30, 40, 30]);
      } catch {
        /* no haptics */
      }
      setTimeout(() => {
        const other = balls.current.find((k) => k !== b && !k.sunk);
        const p = randomSpot(other);
        b.x = p.x;
        b.y = p.y;
        b.sunk = false;
        b.spawnedAt = now + RESPAWN_MS;
      }, RESPAWN_MS);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const keep = Math.pow(FRICTION_PER_S, dt);
      const live = balls.current.filter((b) => !b.sunk);

      for (const b of live) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vx *= keep;
        b.vy *= keep;
        if (Math.hypot(b.vx, b.vy) < 6) b.vx = b.vy = 0;
        if (b.x < R) {
          b.x = R;
          b.vx = Math.abs(b.vx) * RESTITUTION;
        } else if (b.x > w - R) {
          b.x = w - R;
          b.vx = -Math.abs(b.vx) * RESTITUTION;
        }
        if (b.y < R) {
          b.y = R;
          b.vy = Math.abs(b.vy) * RESTITUTION;
        } else if (b.y > h - R) {
          b.y = h - R;
          b.vy = -Math.abs(b.vy) * RESTITUTION;
        }
      }
      // ball-ball (equal mass, elastic)
      if (live.length === 2) {
        const [a, b] = live;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < R * 2) {
          const nx = dx / d;
          const ny = dy / d;
          const overlap = R * 2 - d;
          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          b.x += (nx * overlap) / 2;
          b.y += (ny * overlap) / 2;
          const diff = a.vx * nx + a.vy * ny - (b.vx * nx + b.vy * ny);
          if (diff > 0) {
            a.vx -= diff * nx;
            a.vy -= diff * ny;
            b.vx += diff * nx;
            b.vy += diff * ny;
          }
        }
      }
      for (const b of live) {
        const hole = pockets().find((p) => Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R - 4);
        if (hole) sink(b, hole, now);
      }

      for (const b of balls.current) {
        const el = layerRef.current?.querySelector<HTMLElement>(`[data-ball="${b.kind}"]`);
        if (!el) continue;
        const pop = b.sunk ? 0 : Math.min(1, (now - b.spawnedAt) / 250 + 0.01);
        el.style.transform = `translate(${b.x - R}px, ${b.y - R}px) scale(${pop})`;
      }
      if (aimRef.current && stickRef.current) {
        if (drag) {
          const { ball, px, py } = drag;
          const dx = ball.x - px;
          const dy = ball.y - py;
          const len = Math.hypot(dx, dy);
          const power = Math.min(1, (len * DRAG_GAIN) / MAX_POWER);
          const ux = len ? dx / len : 0;
          const uy = len ? dy / len : 0;
          // cue stick: from the pointer to the ball
          stickRef.current.setAttribute("x1", String(px));
          stickRef.current.setAttribute("y1", String(py));
          stickRef.current.setAttribute("x2", String(ball.x - ux * R));
          stickRef.current.setAttribute("y2", String(ball.y - uy * R));
          stickRef.current.style.opacity = "1";
          // aim: where the ball will go
          aimRef.current.setAttribute("x1", String(ball.x + ux * R));
          aimRef.current.setAttribute("y1", String(ball.y + uy * R));
          aimRef.current.setAttribute("x2", String(ball.x + ux * (R + 40 + power * 220)));
          aimRef.current.setAttribute("y2", String(ball.y + uy * (R + 40 + power * 220)));
          aimRef.current.setAttribute("stroke-width", String(2 + power * 4));
          aimRef.current.style.opacity = "1";
        } else {
          aimRef.current.style.opacity = "0";
          stickRef.current.style.opacity = "0";
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [onScore]);

  return (
    <div ref={layerRef} className="absolute inset-0">
      {(["left-0 top-0", "right-0 top-0", "left-0 bottom-0", "right-0 bottom-0"] as const).map((pos) => (
        <div
          key={pos}
          className={`absolute ${pos} rounded-full`}
          style={{
            margin: POCKET_INSET - POCKET_R,
            width: POCKET_R * 2,
            height: POCKET_R * 2,
            background: "radial-gradient(circle, #000 0%, #07050e 55%, #2b2044 100%)",
            boxShadow: "inset 0 4px 14px rgba(0,0,0,.95), 0 0 0 2px rgba(255,255,255,.08), 0 0 24px rgba(124,58,237,.35)",
          }}
        />
      ))}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="cue" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <line ref={stickRef} stroke="rgba(255,255,255,.35)" strokeWidth="4" strokeLinecap="round" style={{ opacity: 0 }} />
        <line ref={aimRef} stroke="url(#cue)" strokeLinecap="round" strokeDasharray="6 8" style={{ opacity: 0 }} />
      </svg>
      {(["pink", "cue"] as Kind[]).map((kind) => (
        <div
          key={kind}
          data-ball={kind}
          className={`absolute left-0 top-0 rounded-full ${kind === "cue" ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
          style={{
            width: R * 2,
            height: R * 2,
            background: STYLE[kind],
            boxShadow: "inset -4px -6px 10px rgba(0,0,0,.45), 0 8px 18px rgba(0,0,0,.6), 0 0 16px rgba(236,72,153,.25)",
            pointerEvents: kind === "cue" ? "auto" : "none",
            transform: "scale(0)",
          }}
        />
      ))}
      <AnimatePresence>
        {sinkFx.map((f) => (
          <motion.div
            key={`fx-${f.id}`}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -50, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className={`pointer-events-none absolute text-2xl font-extrabold ${f.delta > 0 ? "grad-text" : "text-rose-400"}`}
            style={{ left: Math.min(Math.max(f.x - 20, 12), window.innerWidth - 60), top: Math.max(f.y - 12, 60) }}
          >
            {f.delta > 0 ? "+1" : "−1 😅"}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
