"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { QueueGame } from "./QueueGame";
import { t } from "@/i18n/vi";
import { getName } from "@/lib/identity";
import { useSocket } from "@/lib/socket";

function Dots() {
  // Little blips fading in/out around the radar = "other people out there".
  const [dots, setDots] = useState<{ id: number; x: number; y: number }[]>([]);
  useEffect(() => {
    let id = 0;
    const timer = setInterval(() => {
      const angle = Math.random() * Math.PI * 2;
      const r = 70 + Math.random() * 60;
      const dot = { id: id++, x: Math.cos(angle) * r, y: Math.sin(angle) * r };
      setDots((d) => [...d.slice(-5), dot]);
    }, 700);
    return () => clearInterval(timer);
  }, []);
  return (
    <AnimatePresence>
      {dots.map((d) => (
        <motion.span
          key={d.id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 1.4] }}
          transition={{ duration: 2.4, ease: "easeOut" }}
          className="absolute h-2.5 w-2.5 rounded-full bg-accent-2"
          style={{ left: `calc(50% + ${d.x}px)`, top: `calc(50% + ${d.y}px)` }}
        />
      ))}
    </AnimatePresence>
  );
}

function Ticker({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (shown === value) return;
    const step = value > shown ? 1 : -1;
    const timer = setInterval(() => {
      setShown((s) => {
        if (s === value) {
          clearInterval(timer);
          return s;
        }
        return s + step;
      });
    }, 40);
    return () => clearInterval(timer);
  }, [value, shown]);
  return <span className="tabular-nums">{shown}</span>;
}

export function Queue() {
  const { presence, leaveQueue, cooldownUntil } = useSocket();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const cooldownLeft = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;
  const name = useMemo(() => getName(), []);
  const [hint, setHint] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setHint((h) => (h + 1) % t.queueHints.length), 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center px-4 touch-none"
    >
      <QueueGame />
      <div className="relative flex h-[320px] w-[320px] items-center justify-center">
        {/* dish */}
        <div className="absolute h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.18),rgba(124,58,237,0.04)_60%,transparent_72%)]" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/15"
            style={{ width: 100 * i, height: 100 * i, opacity: 1 - i * 0.18 }}
          />
        ))}
        {/* crosshair */}
        <div className="absolute h-[300px] w-px bg-white/10" />
        <div className="absolute h-px w-[300px] bg-white/10" />
        {/* sonar ripples */}
        <div className="sonar h-[300px] w-[300px]" />
        <div className="sonar h-[300px] w-[300px]" style={{ animationDelay: "1.2s" }} />
        {/* sweep + glowing tip */}
        <div className="radar-sweep absolute h-[300px] w-[300px] rounded-full" />
        <div className="radar-tip h-[300px] w-[300px]" />
        <Dots />
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <Avatar name={name} size={84} />
        </motion.div>
      </div>

      <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{t.queueTitle}</h2>
      <div className="mt-2 h-6 overflow-hidden text-sm text-muted">
        <AnimatePresence mode="wait">
          <motion.p
            key={cooldownLeft > 0 ? "cooldown" : hint}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {cooldownLeft > 0 ? t.cooldown(cooldownLeft) : t.queueHints[hint]}
          </motion.p>
        </AnimatePresence>
      </div>
      <p className="mt-6 text-xs text-muted">
        <Ticker value={presence.online} /> online · <Ticker value={presence.waiting} /> đang chờ
      </p>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={leaveQueue}
        className="glass relative z-20 mt-10 rounded-full px-6 py-3 text-sm font-semibold text-fg/80"
      >
        {t.cancel}
      </motion.button>
    </motion.main>
  );
}
