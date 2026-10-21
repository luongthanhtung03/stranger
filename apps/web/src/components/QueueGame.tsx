"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { GAME_IDS, GAME_META, type GameId } from "@stranger/shared";
import { BilliardsGame } from "./games/BilliardsGame";
import { PongGame } from "./games/PongGame";
import { WhackGame } from "./games/WhackGame";
import { useSocket } from "@/lib/socket";

// Full-screen play layer over the queue screen. Picks a random game per visit
// (never the same one twice in a row) and reports the score to the server so
// the partner's chat can open with it.

const LAST_KEY = "stranger.lastGame";

function pickGame(): GameId {
  // ?game=whack|pong|billiards forces one (handy for testing)
  const forced = new URLSearchParams(window.location.search).get("game") as GameId | null;
  if (forced && GAME_IDS.includes(forced)) return forced;
  let last: string | null = null;
  try {
    last = sessionStorage.getItem(LAST_KEY);
  } catch {
    /* ignore */
  }
  const pool = GAME_IDS.filter((g) => g !== last);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function QueueGame() {
  const { socket } = useSocket();
  const [game] = useState<GameId>(() => (typeof window === "undefined" ? "whack" : pickGame()));
  const [score, setScore] = useState(0);
  const [intro, setIntro] = useState(true);
  const meta = GAME_META[game];

  useEffect(() => {
    // Remembered here, not in the picker: React (dev StrictMode) may run the
    // state initializer twice, which would store a game other than the one shown.
    try {
      sessionStorage.setItem(LAST_KEY, game);
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setIntro(false), 1800);
    return () => clearTimeout(t);
  }, [game]);

  const onScore = useCallback(
    (s: number) => {
      setScore(s);
      socket.emit("game:score", { game, score: s });
    },
    [socket, game],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-10 touch-none select-none">
      {game === "whack" && <WhackGame onScore={onScore} />}
      {game === "pong" && <PongGame onScore={onScore} />}
      {game === "billiards" && <BilliardsGame onScore={onScore} />}

      {/* score pill */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="glass absolute left-1/2 top-[max(14px,env(safe-area-inset-top))] flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold"
      >
        <span>{meta.emoji}</span>
        <span>{meta.title}</span>
        <span className="rounded-full bg-chip px-2 tabular-nums">{score}</span>
      </motion.div>

      <AnimatePresence>
        {intro && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="glass absolute left-1/2 top-[68px] -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-xs text-muted"
          >
            {meta.hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
