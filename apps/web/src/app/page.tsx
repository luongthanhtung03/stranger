"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Landing } from "@/components/Landing";
import { Orbs } from "@/components/Orbs";
import { ParticleField } from "@/components/ParticleField";
import { Queue } from "@/components/Queue";
import { Room } from "@/components/Room";
import { Toast } from "@/components/Toast";
import { t } from "@/i18n/vi";
import { useSocket } from "@/lib/socket";

const REQUEUE_DELAY_MS = 900;

export default function Home() {
  const { match, queued, lastEnd, bannedUntil, joinQueue, connected } = useSocket();
  const [toast, setToast] = useState<string | null>(null);
  const handled = useRef<number | null>(null);

  // When the other side ends the room, tell the user and jump back into the queue.
  useEffect(() => {
    if (!lastEnd || handled.current === lastEnd.at) return;
    handled.current = lastEnd.at;
    const msgs: Partial<Record<typeof lastEnd.reason, string>> = {
      "peer-next": t.endedPeerNext,
      "peer-left": t.endedPeerLeft,
      "peer-disconnected": t.endedPeerLost,
      timer: t.timeUp,
      reported: t.reported,
    };
    const msg = msgs[lastEnd.reason];
    if (msg) {
      // Reacting to a server event (room ended), not to render state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast(msg);
      setTimeout(() => setToast(null), 2600);
    }
    const auto = ["peer-next", "peer-left", "peer-disconnected", "timer"].includes(lastEnd.reason);
    if (auto && !lastEnd.wasPrivate) {
      const timer = setTimeout(joinQueue, REQUEUE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [lastEnd, joinQueue]);

  if (bannedUntil) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
        <Orbs dim />
        <p className="text-4xl">🚫</p>
        <p className="mt-4 text-lg font-bold">{t.banned}</p>
        <p className="mt-2 text-sm text-muted">{new Date(bannedUntil).toLocaleString("vi-VN")}</p>
      </main>
    );
  }

  const phase = match ? "room" : queued ? "queue" : "landing";

  return (
    <>
      {phase !== "room" && (
        <>
          <Orbs dim={phase === "queue"} />
          <ParticleField />
        </>
      )}
      <AnimatePresence mode="wait">
        {phase === "room" && match ? (
          <motion.div key={`room-${match.roomId}`} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.35 }}>
            <Room match={match} />
          </motion.div>
        ) : phase === "queue" ? (
          <Queue key="queue" />
        ) : (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Landing />
          </motion.div>
        )}
      </AnimatePresence>
      <Toast message={toast ?? (!connected && phase !== "landing" ? t.disconnected : null)} />
    </>
  );
}
