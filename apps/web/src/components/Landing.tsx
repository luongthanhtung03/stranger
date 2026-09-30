"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Camera, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NAME_MAX, TAGS } from "@stranger/shared";
import { t } from "@/i18n/vi";
import { getName, getTags, setName as persistName, setTags as persistTags } from "@/lib/identity";
import { useMedia } from "@/lib/media-context";
import { useSocket } from "@/lib/socket";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const rise = {
  hidden: { y: 18, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
};

export function Landing() {
  const media = useMedia();
  const { presence, connect, joinQueue, connected } = useSocket();
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Hydrate from localStorage after mount so SSR and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(getName());
    setTags(getTags());
    setHydrated(true);
    connect(); // presence count + invites while on the landing page
  }, [connect]);

  // Returning users get their camera preview immediately.
  useEffect(() => {
    if (hydrated && getName()) void media.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = media.stream;
  }, [media.stream]);

  const toggleTag = (tag: string) =>
    setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag].slice(0, 4)));

  const canStart = name.trim().length > 0 && !!media.stream;

  const start = async () => {
    if (!name.trim()) return;
    persistName(name.trim());
    persistTags(tags);
    const stream = media.stream ?? (await media.open());
    if (!stream) return;
    connect();
    joinQueue();
  };

  return (
    <motion.main
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-8 pt-[max(16px,env(safe-area-inset-top))]"
    >
      <motion.header variants={rise} className="flex items-center justify-between py-2">
        <span className="grad-text text-lg font-extrabold tracking-tight">{t.appName}</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400 breathe" : "bg-muted"}`} />
            {t.online(presence.online)}
          </span>
          <Link href="/friends" aria-label={t.friends} className="glass rounded-full p-2 text-fg/80">
            <Users size={18} />
          </Link>
        </div>
      </motion.header>

      <div className="flex flex-1 flex-col justify-center gap-6 py-6">
        <div>
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-[52px]">
            {t.tagline.map((line, i) => (
              <motion.span key={i} variants={rise} className={`block ${i === 1 ? "grad-text" : ""}`}>
                {line}
              </motion.span>
            ))}
          </h1>
          <motion.p variants={rise} className="mt-3 text-[15px] text-muted">
            {t.sub}
          </motion.p>
        </div>

        <motion.div
          variants={rise}
          className="glow relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-card)] bg-surface"
        >
          <video ref={videoRef} autoPlay muted playsInline className="mirror h-full w-full object-cover" />
          {!media.stream && (
            <button
              onClick={() => void media.open()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted"
            >
              <span className="glass rounded-full p-3">
                <Camera size={22} />
              </span>
              {media.error ? <span className="px-6 text-center text-xs">{t.cameraDenied}</span> : t.needCamera}
            </button>
          )}
        </motion.div>

        <motion.div variants={rise}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            onKeyDown={(e) => e.key === "Enter" && canStart && void start()}
            placeholder={t.namePlaceholder}
            maxLength={NAME_MAX}
            autoComplete="off"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-base font-medium outline-none transition-shadow focus:border-accent/60 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.25)]"
          />
        </motion.div>

        <motion.div variants={rise}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t.tagsLabel}</p>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <motion.button
                  key={tag}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    on ? "grad border-transparent font-bold text-white" : "border-line bg-surface text-fg/80"
                  }`}
                >
                  {tag}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={rise} className="pt-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.01 }}
            disabled={!canStart}
            onClick={() => void start()}
            className={`grad relative w-full rounded-full py-4 text-lg font-extrabold text-white transition-opacity ${
              canStart ? "glow pulse-ring" : "opacity-40"
            }`}
          >
            {t.start}
          </motion.button>
        </motion.div>
      </div>
    </motion.main>
  );
}
