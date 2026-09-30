"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Giữ bóng: keep glowing balls in play with the paddle at the bottom while
// smashing the neon bricks at the top. Every save speeds things up, extra
// balls join as you go, and a cleared wall comes back faster. Lose them all
// and it restarts.

const R = 13;
const PADDLE_W = 120;
const PADDLE_H = 14;
const PADDLE_BOTTOM = 26;
const START_SPEED = 340;
const SPEED_UP = 1.08; // per save
const SPEED_DRIFT = 0.025; // +2.5 % per second, always
const MAX_SPEED = 1500;
const MAX_BALLS = 3;
const SAVES_PER_EXTRA_BALL = 5;
const TRAIL = 7;
const COLS = 5;
const ROWS = 3;
const BRICK_H = 26;
const BRICK_TOP = 104;
const BRICK_GAP = 8;
const SAVE_PTS = 1;
const BRICK_PTS = 2;

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
}
interface Brick {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  hue: number;
}

function makeWall(wave: number): Brick[] {
  const w = window.innerWidth;
  const bw = (w - 32 - BRICK_GAP * (COLS - 1)) / COLS;
  const bricks: Brick[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      bricks.push({
        id: wave * 100 + r * COLS + c,
        x: 16 + c * (bw + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        w: bw,
        h: BRICK_H,
        alive: true,
        hue: 265 + r * 25 + c * 6,
      });
  return bricks;
}

export function PongGame({ onScore }: { onScore: (score: number) => void }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const paddleRef = useRef<HTMLDivElement>(null);
  const [balls, setBalls] = useState<number[]>([1]);
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [over, setOver] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const wallRef = useRef<Brick[]>([]);
  const wave = useRef(1);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const paddle = { x: W() / 2, target: W() / 2 };
    let live: Ball[] = [];
    let nextId = 1;
    let speed = START_SPEED;
    let saves = 0;
    let score = 0;
    let dead = false;
    let deadUntil = 0;

    const newBall = (): Ball => {
      const a = (Math.random() * 0.5 + 0.25) * Math.PI; // mostly downward
      const id = nextId++;
      return { id, x: W() * (0.3 + Math.random() * 0.4), y: H() * 0.42, vx: Math.cos(a) * speed, vy: Math.abs(Math.sin(a)) * speed, trail: [] };
    };
    const syncBalls = () => setBalls(live.map((b) => b.id));
    const newWall = () => {
      wallRef.current = makeWall(wave.current++);
      setBricks(wallRef.current);
    };
    const reset = () => {
      speed = START_SPEED;
      saves = 0;
      score = 0;
      live = [newBall()];
      syncBalls();
      newWall();
    };
    reset();

    const onMove = (e: PointerEvent) => {
      paddle.target = e.clientX;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const w = W();
      const h = H();
      paddle.x += (paddle.target - paddle.x) * 0.35;
      paddle.x = Math.max(PADDLE_W / 2, Math.min(w - PADDLE_W / 2, paddle.x));
      const py = h - PADDLE_BOTTOM - PADDLE_H;

      if (dead) {
        if (now > deadUntil) {
          dead = false;
          setOver(null);
          reset();
        }
      } else {
        speed = Math.min(MAX_SPEED, speed * (1 + SPEED_DRIFT * dt));
        for (const b of live) {
          // keep every ball at the current speed so the drift applies to all
          const cur = Math.hypot(b.vx, b.vy) || 1;
          b.vx *= speed / cur;
          b.vy *= speed / cur;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < R) {
            b.x = R;
            b.vx = Math.abs(b.vx);
          } else if (b.x > w - R) {
            b.x = w - R;
            b.vx = -Math.abs(b.vx);
          }
          if (b.y < R) {
            b.y = R;
            b.vy = Math.abs(b.vy);
          }
          // bricks
          for (const k of wallRef.current) {
            if (!k.alive) continue;
            const cx = Math.max(k.x, Math.min(b.x, k.x + k.w));
            const cy = Math.max(k.y, Math.min(b.y, k.y + k.h));
            const dx = b.x - cx;
            const dy = b.y - cy;
            if (dx * dx + dy * dy > R * R) continue;
            k.alive = false;
            score += BRICK_PTS;
            onScore(score);
            setBricks([...wallRef.current]);
            // reflect on the axis of least penetration
            const penX = R - Math.abs(dx);
            const penY = R - Math.abs(dy);
            if (penX < penY || dy === 0) b.vx = dx >= 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
            else b.vy = dy >= 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
            if (wallRef.current.every((q) => !q.alive)) {
              speed = Math.min(MAX_SPEED, speed * 1.15);
              setTimeout(newWall, 400);
            }
            break;
          }
          // paddle
          if (b.vy > 0 && b.y + R >= py && b.y - R <= py + PADDLE_H && Math.abs(b.x - paddle.x) <= PADDLE_W / 2 + R * 0.6) {
            speed = Math.min(MAX_SPEED, speed * SPEED_UP);
            const angle = ((b.x - paddle.x) / (PADDLE_W / 2)) * 1.05;
            b.vx = Math.sin(angle) * speed;
            b.vy = -Math.cos(angle) * speed;
            b.y = py - R;
            saves += 1;
            score += SAVE_PTS;
            onScore(score);
            if (saves % SAVES_PER_EXTRA_BALL === 0 && live.length < MAX_BALLS) {
              live.push(newBall());
              syncBalls();
            }
            try {
              navigator.vibrate?.(10);
            } catch {
              /* no haptics */
            }
          }
          b.trail.unshift({ x: b.x, y: b.y });
          if (b.trail.length > TRAIL) b.trail.pop();
        }
        const before = live.length;
        live = live.filter((b) => b.y <= h + R * 2);
        if (live.length !== before) syncBalls();
        if (live.length === 0) {
          dead = true;
          deadUntil = now + 1500;
          setBest((v) => Math.max(v, score));
          setOver(score);
        }
      }

      const layer = layerRef.current;
      if (layer) {
        for (const b of live) {
          const el = layer.querySelector<HTMLElement>(`[data-ball="${b.id}"]`);
          if (el) el.style.transform = `translate(${b.x - R}px, ${b.y - R}px)`;
          b.trail.forEach((t, i) => {
            const tl = layer.querySelector<HTMLElement>(`[data-trail="${b.id}-${i}"]`);
            if (!tl) return;
            const s = 1 - (i + 1) / TRAIL;
            tl.style.opacity = String(0.5 * s);
            tl.style.transform = `translate(${t.x - R * s}px, ${t.y - R * s}px) scale(${s})`;
          });
        }
      }
      if (paddleRef.current) paddleRef.current.style.transform = `translate(${paddle.x - PADDLE_W / 2}px, ${py}px)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, [onScore]);

  return (
    <div ref={layerRef} className="absolute inset-0">
      <AnimatePresence>
        {bricks.map(
          (k) =>
            k.alive && (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, scale: 0.6, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.4, rotate: (k.id % 2 ? 1 : -1) * 12 }}
                transition={{ duration: 0.22 }}
                className="absolute rounded-lg"
                style={{
                  left: k.x,
                  top: k.y,
                  width: k.w,
                  height: k.h,
                  background: `linear-gradient(135deg, hsla(${k.hue},85%,65%,.55), hsla(${k.hue + 30},85%,55%,.35))`,
                  border: "1px solid rgba(255,255,255,.25)",
                  boxShadow: `0 0 14px hsla(${k.hue},90%,65%,.45), inset 0 1px 0 rgba(255,255,255,.35)`,
                }}
              />
            ),
        )}
      </AnimatePresence>
      {balls.map((id) => (
        <div key={id}>
          {Array.from({ length: TRAIL - 1 }, (_, i) => (
            <div
              key={i}
              data-trail={`${id}-${i}`}
              className="absolute left-0 top-0 rounded-full bg-accent-2"
              style={{ width: R * 2, height: R * 2, opacity: 0, filter: "blur(2px)" }}
            />
          ))}
          <div
            data-ball={id}
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: R * 2,
              height: R * 2,
              background: "radial-gradient(circle at 35% 30%, #fff 0%, #f0abfc 25%, #a855f7 60%, #6d28d9 100%)",
              boxShadow: "0 0 18px 4px rgba(236,72,153,.7), 0 0 40px 10px rgba(168,85,247,.45)",
            }}
          />
        </div>
      ))}
      <div
        ref={paddleRef}
        className="glass absolute left-0 top-0 rounded-full"
        style={{
          width: PADDLE_W,
          height: PADDLE_H,
          background: "linear-gradient(90deg, #7c3aed, #ec4899)",
          boxShadow: "0 0 20px rgba(168,85,247,.7)",
        }}
      />
      <AnimatePresence>
        {over !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 rounded-2xl px-5 py-3 text-center"
          >
            <p className="text-lg font-extrabold">Rớt hết rồi! 💥</p>
            <p className="text-sm text-muted">
              {over} điểm · kỷ lục {best}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
