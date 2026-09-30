"use client";

import { motion } from "framer-motion";
import { Avatar } from "./Avatar";
import { t } from "@/i18n/vi";

// Two avatars slide in from the sides and bump — shown briefly over the room.
export function MatchIntro({ me, peer }: { me: string; peer: string }) {
  const spring = { type: "spring" as const, stiffness: 320, damping: 16 };
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-bg/85 backdrop-blur-md"
    >
      <div className="flex items-center">
        <motion.div initial={{ x: -160, rotate: -20 }} animate={{ x: 10, rotate: 0 }} transition={spring}>
          <Avatar name={me} size={88} />
        </motion.div>
        <motion.div initial={{ x: 160, rotate: 20 }} animate={{ x: -10, rotate: 0 }} transition={spring}>
          <Avatar name={peer} size={88} />
        </motion.div>
      </div>
      <motion.p
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="grad-text mt-6 text-3xl font-extrabold"
      >
        {t.matched}
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-1 text-sm text-muted"
      >
        {peer}
      </motion.p>
    </motion.div>
  );
}
