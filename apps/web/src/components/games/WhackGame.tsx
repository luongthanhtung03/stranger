"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Đập chuột: moles pop out of holes anywhere on the screen. Tap them before
// they duck back down. Spawns get faster the longer you last.

interface Mole {
  id: number;
  x: number;
  y: number;
  hit: boolean;
}

const SIZE = 104;
const LIFE_MS = 1300;
const START_GAP = 1100;
const MIN_GAP = 480;
const SAFE_BOTTOM = 130; // keep the Huỷ button reachable

export function WhackGame({ onScore }: { onScore: (score: number) => void }) {
  const [moles, setMoles] = useState<Mole[]>([]);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; combo: number }[]>([]);
  const score = useRef(0);
  const combo = useRef(0);
  const nextId = useRef(1);
  const gap = useRef(START_GAP);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const spawn = () => {
      const id = nextId.current++;
      const x = 24 + Math.random() * (window.innerWidth - SIZE - 48);
      const y = 70 + Math.random() * (window.innerHeight - SIZE - SAFE_BOTTOM - 70);
      setMoles((m) => [...m.slice(-4), { id, x, y, hit: false }]);
      setTimeout(() => {
        setMoles((m) => {
          const mole = m.find((k) => k.id === id);
          if (mole && !mole.hit) combo.current = 0; // got away
          return m.filter((k) => k.id !== id);
        });
      }, LIFE_MS);
      gap.current = Math.max(MIN_GAP, gap.current - 22);
      timer = setTimeout(spawn, gap.current);
    };
    timer = setTimeout(spawn, 500);
    return () => clearTimeout(timer);
  }, []);

  const whack = (mole: Mole) => {
    if (mole.hit) return;
    combo.current += 1;
    score.current += 1;
    onScore(score.current);
    setMoles((m) => m.map((k) => (k.id === mole.id ? { ...k, hit: true } : k)));
    setPops((p) => [...p.slice(-6), { id: mole.id, x: mole.x, y: mole.y, combo: combo.current }]);
    setTimeout(() => setMoles((m) => m.filter((k) => k.id !== mole.id)), 260);
    setTimeout(() => setPops((p) => p.filter((k) => k.id !== mole.id)), 900);
    try {
      navigator.vibrate?.(15);
    } catch {
      /* no haptics */
    }
  };

  return (
    <>
      <AnimatePresence>
        {moles.map((mole) => (
          <div
            key={mole.id}
            className="absolute"
            style={{ left: mole.x, top: mole.y, width: SIZE, height: SIZE, perspective: 500 }}
          >
            {/* hole: dark ellipse with a lit rim, slightly tilted toward the viewer */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="absolute bottom-3 left-1/2 h-9 w-[92px] -translate-x-1/2 rounded-[50%]"
              style={{
                background: "radial-gradient(ellipse at 50% 40%, #05030a 0%, #0d0a1a 55%, #2a1f45 100%)",
                boxShadow: "inset 0 6px 10px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.12), 0 8px 24px rgba(0,0,0,.5)",
              }}
            />
            {/* mask: the mole only exists above the hole's rim */}
            <div className="absolute inset-x-0 bottom-[30px] top-0 overflow-hidden">
              <motion.button
                aria-label="chuột"
                onPointerDown={() => whack(mole)}
                initial={{ y: "110%", rotateX: 35, scaleY: 0.85 }}
                animate={
                  mole.hit
                    ? { y: "35%", scaleY: 0.55, scaleX: 1.25, rotateX: 0 }
                    : { y: ["110%", "-2%", "6%"], rotateX: [35, -8, 0], scaleY: [0.85, 1.05, 1] }
                }
                exit={{ y: "110%", rotateX: 30 }}
                transition={mole.hit ? { duration: 0.15 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-0 left-1/2 h-[78px] w-[66px] -translate-x-1/2 cursor-pointer touch-none select-none"
                style={{ transformOrigin: "50% 100%", transformStyle: "preserve-3d", pointerEvents: "auto" }}
              >
                {/* ears */}
                <span className="absolute -top-1 left-1 h-6 w-6 rounded-full" style={{ background: "radial-gradient(circle at 40% 40%, #d9a074, #6b3f22)" }} />
                <span className="absolute -top-1 right-1 h-6 w-6 rounded-full" style={{ background: "radial-gradient(circle at 60% 40%, #d9a074, #6b3f22)" }} />
                {/* body */}
                <span
                  className="absolute inset-x-0 top-2 bottom-0 rounded-t-[36px] rounded-b-[12px]"
                  style={{
                    background: "radial-gradient(circle at 38% 28%, #e0b088 0%, #b57a4f 35%, #7a4a2a 75%, #4a2a15 100%)",
                    boxShadow: "inset -8px -10px 18px rgba(0,0,0,.45), inset 6px 6px 12px rgba(255,255,255,.18), 0 10px 20px rgba(0,0,0,.5)",
                  }}
                />
                {/* eyes */}
                <span className="absolute left-[16px] top-[26px] h-3.5 w-3.5 rounded-full bg-white shadow-inner">
                  <span className="absolute left-[5px] top-[4px] h-2 w-2 rounded-full bg-black" />
                </span>
                <span className="absolute right-[16px] top-[26px] h-3.5 w-3.5 rounded-full bg-white shadow-inner">
                  <span className="absolute left-[3px] top-[4px] h-2 w-2 rounded-full bg-black" />
                </span>
                {/* nose + cheeks */}
                <span className="absolute left-1/2 top-[44px] h-3 w-4 -translate-x-1/2 rounded-full bg-[#f28aa5] shadow" />
                <span className="absolute left-[8px] top-[48px] h-3 w-4 rounded-full bg-[#f4a3b3]/50" />
                <span className="absolute right-[8px] top-[48px] h-3 w-4 rounded-full bg-[#f4a3b3]/50" />
              </motion.button>
            </div>
          </div>
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {pops.map((p) => (
          <motion.div
            key={`pop-${p.id}`}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -60, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="pointer-events-none absolute grad-text text-2xl font-extrabold"
            style={{ left: p.x + SIZE / 2 - 20, top: p.y }}
          >
            +1{p.combo >= 3 ? ` ×${p.combo}` : ""}
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
}
