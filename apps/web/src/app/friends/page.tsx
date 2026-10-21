"use client";

import { motion } from "framer-motion";
import { ArrowLeft, PhoneCall } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FriendStatus } from "@stranger/shared";
import { Avatar } from "@/components/Avatar";
import { Orbs } from "@/components/Orbs";
import { SchoolBadge } from "@/components/SchoolPicker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toast } from "@/components/Toast";
import { t } from "@/i18n/vi";
import { getFriends, type Friend } from "@/lib/identity";
import { useMedia } from "@/lib/media-context";
import { useSocket } from "@/lib/socket";

const STATUS_POLL_MS = 8000;

export default function FriendsPage() {
  const { socket, connect, match } = useSocket();
  const media = useMedia();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [status, setStatus] = useState<Record<string, FriendStatus>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    // Hydrate from localStorage after mount so SSR and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFriends(getFriends());
    connect();
  }, [connect]);

  // Poll who is online right now.
  useEffect(() => {
    const ask = () => {
      const ids = getFriends().map((f) => f.deviceId);
      if (ids.length) socket.emit("friend:status", { deviceIds: ids });
    };
    const onStatus = ({ status }: { status: Record<string, FriendStatus> }) => setStatus(status);
    const onResult = ({ accepted }: { inviteId: string; accepted: boolean }) => {
      setPending(null);
      if (!accepted) show(t.inviteDeclined);
    };
    socket.on("friend:status", onStatus);
    socket.on("friend:invite:result", onResult);
    socket.on("connect", ask);
    ask();
    const timer = setInterval(ask, STATUS_POLL_MS);
    return () => {
      clearInterval(timer);
      socket.off("friend:status", onStatus);
      socket.off("friend:invite:result", onResult);
      socket.off("connect", ask);
    };
  }, [socket]);

  // An accepted invite produces a match → go to the room.
  useEffect(() => {
    if (match) router.push("/");
  }, [match, router]);

  const call = async (f: Friend) => {
    const stream = media.stream ?? (await media.open());
    if (!stream) return show(t.cameraDenied);
    setPending(f.deviceId);
    socket.emit("friend:invite", { deviceId: f.deviceId });
    show(t.inviteSent);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-8 pt-[max(16px,env(safe-area-inset-top))]">
      <Orbs dim />
      <header className="flex items-center gap-3 py-2">
        <Link href="/" aria-label={t.back} className="glass rounded-full p-2">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">{t.friendsTitle}</h1>
        <ThemeToggle />
      </header>

      {friends.length === 0 ? (
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-16 text-center text-sm text-muted">
          {t.friendsEmpty}
        </motion.p>
      ) : (
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          className="mt-4 flex flex-col gap-2"
        >
          {friends.map((f) => {
            const st = status[f.deviceId] ?? "offline";
            const isOnline = st === "online";
            return (
              <motion.li
                key={f.deviceId}
                variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                className="glass flex items-center gap-3 rounded-2xl p-3"
              >
                <div className="relative">
                  <Avatar name={f.name} size={46} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-bg ${
                      isOnline ? "bg-emerald-400 breathe" : st === "busy" ? "bg-amber-400" : "bg-muted"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-bold">
                    <span className="truncate">{f.name}</span>
                    <SchoolBadge id={f.school} />
                  </p>
                  <p className="text-xs text-muted">
                    {isOnline ? t.onlineTag : st === "busy" ? t.busyTag : t.offline} · {t.metAt(new Date(f.metAt).toLocaleDateString("vi-VN"))}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  disabled={!isOnline || pending === f.deviceId}
                  onClick={() => void call(f)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold ${
                    isOnline ? "grad glow text-white" : "bg-chip text-muted"
                  } ${pending === f.deviceId ? "opacity-60" : ""}`}
                >
                  <PhoneCall size={15} />
                  {t.callAgain}
                </motion.button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
      <Toast message={toast} />
    </main>
  );
}
