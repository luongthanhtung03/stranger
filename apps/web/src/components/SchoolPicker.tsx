"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SCHOOLS, schoolById } from "@stranger/shared";
import { t } from "@/i18n/vi";

// Accent-insensitive search so "bach khoa" finds "Bách khoa".
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export function SchoolBadge({ id, className = "" }: { id: string | null | undefined; className?: string }) {
  const school = schoolById(id);
  if (!school || school.id === "other") return null;
  return (
    <span
      title={school.name}
      className={`grad shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white ${className}`}
    >
      🎓 {school.short}
    </span>
  );
}

export function SchoolPicker({
  open,
  value,
  onClose,
  onPick,
}: {
  open: boolean;
  value: string | null;
  onClose: () => void;
  onPick: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const f = fold(q.trim());
    return f ? SCHOOLS.filter((s) => fold(`${s.short} ${s.name}`).includes(f)) : SCHOOLS;
  }, [q]);

  const pick = (id: string | null) => {
    onPick(id);
    setQ("");
  };

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
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80dvh] border border-line bg-surface/95 backdrop-blur-xl max-w-[480px] flex-col rounded-t-3xl p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-chip-strong" />
            <h3 className="mb-3 text-lg font-extrabold">{t.schoolTitle}</h3>
            <label className="mb-3 flex shrink-0 items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
              <Search size={16} className="text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.schoolSearch}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <motion.ul
              key={q}
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.025 } } }}
              className="-mx-1 flex flex-col gap-1 overflow-y-auto px-1"
            >
              <SchoolRow selected={!value} onClick={() => pick(null)} label={t.schoolNone} />
              {list.map((s) => (
                <SchoolRow key={s.id} selected={value === s.id} onClick={() => pick(s.id)} short={s.short} label={s.name} />
              ))}
            </motion.ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SchoolRow({
  selected,
  onClick,
  short,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  short?: string;
  label: string;
}) {
  return (
    <motion.li variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
          selected ? "bg-chip-strong font-bold" : "hover:bg-chip"
        }`}
      >
        {short && <span className="w-14 shrink-0 text-xs font-extrabold text-muted">{short}</span>}
        <span className="flex-1">{label}</span>
        {selected && <Check size={16} className="text-accent" />}
      </motion.button>
    </motion.li>
  );
}
