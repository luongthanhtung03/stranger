"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import type { Icebreaker } from "@stranger/shared";
import { t } from "@/i18n/vi";

export function IcebreakerCard({ card, onNext }: { card: Icebreaker | null; onNext: () => void }) {
  return (
    <div className="relative min-h-[96px] [perspective:1000px]">
      <AnimatePresence mode="wait">
        {card && (
          <motion.div
            key={card.id}
            initial={{ rotateY: 90, x: 40, opacity: 0 }}
            animate={{ rotateY: 0, x: 0, opacity: 1 }}
            exit={{ rotateY: -90, x: -40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="glass rounded-2xl p-4 [transform-style:preserve-3d]"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="grad-text text-[11px] font-bold uppercase tracking-wider">
                {t.categories[card.category]}
              </span>
              <motion.button
                whileTap={{ scale: 0.9, rotate: 180 }}
                onClick={onNext}
                aria-label={t.nextCard}
                className="rounded-full p-1 text-muted"
              >
                <Shuffle size={16} />
              </motion.button>
            </div>
            <p data-card className="text-[15px] font-semibold leading-snug">{card.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
