"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHAT_MAX } from "@stranger/shared";
import { t } from "@/i18n/vi";
import type { AppSocket } from "@/lib/socket";

// In-room text chat, relayed by the server (nothing stored). Closed: new lines
// float up over the video and fade, live-stream style. Open: scrollable history
// plus an input. The partner's queue-game brag opens the chat as a system line.

const FLOAT_MS = 8000;
const FLOAT_MAX = 4;
const HISTORY_MAX = 50;

interface Msg {
  id: number;
  from: "me" | "peer" | "system";
  text: string;
  at: number;
}

export function ChatPanel({
  socket,
  brag,
  open,
  now,
  onUnread,
}: {
  socket: AppSocket;
  brag: string | null;
  open: boolean;
  now: number;
  onUnread: (unread: boolean) => void;
}) {
  const nextId = useRef(0);
  const [msgs, setMsgs] = useState<Msg[]>(() =>
    brag ? [{ id: -1, from: "system", text: brag, at: Date.now() }] : [],
  );
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);

  const push = (from: Msg["from"], text: string) =>
    setMsgs((m) => [...m, { id: nextId.current++, from, text, at: Date.now() }].slice(-HISTORY_MAX));

  useEffect(() => {
    openRef.current = open;
    if (open) {
      onUnread(false);
      inputRef.current?.focus();
    }
  }, [open, onUnread]);

  useEffect(() => {
    const onChat = ({ text }: { text: string; at: number }) => {
      push("peer", text);
      if (!openRef.current) onUnread(true);
    };
    socket.on("room:chat", onChat);
    return () => {
      socket.off("room:chat", onChat);
    };
  }, [socket, onUnread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const send = () => {
    const text = draft.replace(/\s+/g, " ").trim().slice(0, CHAT_MAX);
    if (!text) return;
    socket.emit("room:chat", { text });
    push("me", text);
    setDraft("");
  };

  const shown = open ? msgs : msgs.filter((m) => now - m.at < FLOAT_MS).slice(-FLOAT_MAX);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={listRef}
        className={`flex flex-col gap-1.5 ${open ? "max-h-[32dvh] overflow-y-auto pr-1" : "pointer-events-none"}`}
      >
        <AnimatePresence initial={false}>
          {shown.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ y: 12, scale: 0.9, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.3 } }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className={`max-w-[80%] break-words px-3 py-1.5 text-sm ${
                m.from === "me"
                  ? "grad self-end rounded-2xl rounded-br-md font-medium text-white"
                  : m.from === "peer"
                    ? "glass self-start rounded-2xl rounded-bl-md"
                    : "glass self-center rounded-full text-center text-xs font-semibold"
              }`}
            >
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ y: 16, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="glass flex items-center gap-1 rounded-full p-1 pl-4"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX))}
              placeholder={t.chatPlaceholder}
              maxLength={CHAT_MAX}
              enterKeyHint="send"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
            <motion.button
              type="submit"
              whileTap={{ scale: 0.88 }}
              disabled={!draft.trim()}
              aria-label={t.send}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-opacity ${
                draft.trim() ? "grad text-white" : "bg-chip text-muted"
              }`}
            >
              <SendHorizontal size={17} />
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
