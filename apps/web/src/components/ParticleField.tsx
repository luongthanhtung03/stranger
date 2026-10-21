"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";

// Ambient "people out there" background: drifting dots that link up when
// close, get pulled toward the cursor/finger, plus a soft glow that follows it.
// Dark theme: a warm additive "flashlight". Light theme: additive light would
// vanish on a pale background, so the glow becomes a violet tint instead.

const LINK_DIST = 120;
const PULL_DIST = 240;
const LIGHT_R = 230; // radius of the warm "flashlight" around the pointer

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  pink: boolean;
}

// Lit colors per theme, as "r, g, b" so alpha can vary per frame.
const LIT = {
  dark: { glow: ["255, 241, 190", "255, 225, 160", "255, 220, 150"], link: "255, 236, 190", dot: "255, 240, 200", blend: "lighter" },
  light: { glow: ["124, 58, 237", "168, 85, 247", "236, 72, 153"], link: "109, 40, 217", dot: "91, 33, 182", blend: "source-over" },
} as const;

export function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles: P[] = [];
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
    let raf = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(110, (w * h) / 11000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1 + Math.random() * 1.8,
        pink: Math.random() < 0.35,
      }));
    };

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
      // The overlay light sits above the content, so it shows even over cards;
      // moved straight from the event so it never depends on the canvas loop.
      const light = lightRef.current;
      if (light) {
        light.style.transform = `translate(${e.clientX - LIGHT_R}px, ${e.clientY - LIGHT_R}px)`;
        light.style.opacity = "1";
      }
      if (!mouse.active) {
        // First contact: snap instead of easing in from off-screen.
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      }
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      if (lightRef.current) lightRef.current.style.opacity = "0";
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      const lit = LIT[themeRef.current];
      const glowA = themeRef.current === "light" ? 0.4 : 1;

      // Warm light around the pointer (eased for a silky feel), drawn additively
      // so it brightens whatever is underneath instead of tinting it.
      if (mouse.active) {
        mouse.x += (mouse.tx - mouse.x) * 0.18;
        mouse.y += (mouse.ty - mouse.y) * 0.18;
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, LIGHT_R);
        g.addColorStop(0, `rgba(${lit.glow[0]}, ${0.5 * glowA})`);
        g.addColorStop(0.35, `rgba(${lit.glow[1]}, ${0.18 * glowA})`);
        g.addColorStop(1, `rgba(${lit.glow[2]}, 0)`);
        ctx.globalCompositeOperation = lit.blend;
        ctx.fillStyle = g;
        ctx.fillRect(mouse.x - LIGHT_R, mouse.y - LIGHT_R, LIGHT_R * 2, LIGHT_R * 2);
        ctx.globalCompositeOperation = "source-over";
      }
      // 0..1 — how close a point is to the light; dots and links near it glow.
      const litness = (x: number, y: number) =>
        mouse.active ? Math.max(0, 1 - Math.hypot(x - mouse.x, y - mouse.y) / LIGHT_R) : 0;

      for (const p of particles) {
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < PULL_DIST && d > 1) {
            // Gentle pull toward the cursor, softer up close so they orbit rather than pile up.
            const f = ((PULL_DIST - d) / PULL_DIST) * (d < 50 ? -0.02 : 0.015);
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }
        p.vx *= 0.985;
        p.vy *= 0.985;
        if (reduced) {
          p.vx = 0;
          p.vy = 0;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      // Links
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;
          const near = litness((a.x + b.x) / 2, (a.y + b.y) / 2);
          const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * (0.1 + near * 0.5);
          ctx.strokeStyle = near > 0.05 ? `rgba(${lit.link}, ${alpha})` : `rgba(167, 139, 250, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Dots
      for (const p of particles) {
        const near = litness(p.x, p.y);
        const alpha = 0.35 + near * 0.65;
        ctx.fillStyle =
          near > 0.05
            ? `rgba(${lit.dot}, ${alpha})`
            : p.pink
              ? `rgba(236, 72, 153, ${alpha})`
              : `rgba(167, 139, 250, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + near * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }

      // Always keep drawing: with reduced motion the dots stand still, but the
      // light must still follow the pointer (it only moves when the user does).
      raf = requestAnimationFrame(frame);
    };

    resize();
    frame();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />
      <div
        ref={lightRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-30 rounded-full opacity-0 transition-opacity duration-300"
        style={{
          width: LIGHT_R * 2,
          height: LIGHT_R * 2,
          mixBlendMode: theme === "light" ? "multiply" : "screen",
          background:
            theme === "light"
              ? "radial-gradient(circle, rgba(196,170,255,0.35) 0%, rgba(236,190,240,0.14) 35%, rgba(255,255,255,0) 70%)"
              : "radial-gradient(circle, rgba(255,241,190,0.38) 0%, rgba(255,225,160,0.14) 35%, rgba(255,220,150,0) 70%)",
        }}
      />
    </>
  );
}
