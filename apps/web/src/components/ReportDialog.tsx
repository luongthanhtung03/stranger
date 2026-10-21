"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReportReason } from "@stranger/shared";
import { t } from "@/i18n/vi";

export function ReportDialog({
  open,
  onClose,
  onReport,
}: {
  open: boolean;
  onClose: () => void;
  onReport: (reason: ReportReason) => void;
}) {
  const reasons = Object.keys(t.reportReasons) as ReportReason[];
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="glass fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] rounded-t-3xl p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-chip-strong" />
            <h3 className="mb-3 text-lg font-extrabold">{t.reportTitle}</h3>
            <div className="flex flex-col gap-2">
              {reasons.map((r) => (
                <motion.button
                  key={r}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onReport(r)}
                  className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left text-sm font-semibold"
                >
                  {t.reportReasons[r]}
                </motion.button>
              ))}
            </div>
            <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-muted">
              {t.cancel}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
