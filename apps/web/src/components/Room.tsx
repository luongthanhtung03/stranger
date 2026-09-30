"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Flag, Heart, Leaf, Mic, MicOff, PhoneOff, SkipForward, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EXTEND_MS,
  EXTEND_PROMPT_MS,
  NEXT_LOCK_MS,
  type Icebreaker,
  type PeerInfo,
  type ReportReason,
  type RtcSignal,
} from "@stranger/shared";
import { IcebreakerCard } from "./IcebreakerCard";
import { MatchIntro } from "./MatchIntro";
import { QualityBadge } from "./QualityBadge";
import { ReportDialog } from "./ReportDialog";
import { RoundTimer } from "./RoundTimer";
import { Toast } from "./Toast";
import { t } from "@/i18n/vi";
import { addBlocked, addFriend, getName } from "@/lib/identity";
import { useMedia } from "@/lib/media-context";
import { useSocket, type Match } from "@/lib/socket";
import { createPeer, type PeerHandle, type QualityStats } from "@/lib/webrtc";

const INTRO_MS = 1600;
const CONTROLS_HIDE_MS = 3000;

export function Room({ match }: { match: Match }) {
  const { socket, joinQueue, clearMatch } = useSocket();
  const media = useMedia();
  const remoteRef = useRef<HTMLVideoElement>(null);
  const selfRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<PeerHandle | null>(null);

  const [intro, setIntro] = useState(true);
  const [connState, setConnState] = useState<RTCPeerConnectionState>("new");
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [reveal, setReveal] = useState({ me: false, peer: false, revealed: match.private });
  const [endsAt, setEndsAt] = useState(match.endsAt);
  const [extend, setExtend] = useState({ me: false, peer: false });
  const [card, setCard] = useState<Icebreaker | null>(match.card);
  const [connectPressed, setConnectPressed] = useState(false);
  const [connectedPeer, setConnectedPeer] = useState<PeerInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [controls, setControls] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [mountedAt] = useState(() => Date.now());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // --- WebRTC lifecycle -----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    // The initiator's offer can arrive before this effect has built our peer
    // connection; buffer signals until it exists, then replay them in order.
    const pending: RtcSignal[] = [];
    (async () => {
      const stream = media.stream ?? (await media.open());
      if (!stream || cancelled) return;
      const peer = createPeer({
        iceServers: match.iceServers,
        initiator: match.initiator,
        localStream: stream,
        dataSaver: media.dataSaver,
        sendSignal: (s: RtcSignal) => socket.emit("rtc:signal", s),
        onRemoteStream: setRemote,
        onState: setConnState,
        onStats: setStats,
      });
      peerRef.current = peer;
      for (const s of pending.splice(0)) await peer.handleSignal(s);
    })();
    const onSignal = (s: RtcSignal) => {
      if (peerRef.current) void peerRef.current.handleSignal(s);
      else pending.push(s);
    };
    socket.on("rtc:signal", onSignal);
    return () => {
      cancelled = true;
      socket.off("rtc:signal", onSignal);
      peerRef.current?.close();
      peerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.roomId]);

  useEffect(() => {
    if (remoteRef.current && remote) remoteRef.current.srcObject = remote;
  }, [remote]);
  useEffect(() => {
    if (selfRef.current) selfRef.current.srcObject = media.stream;
  }, [media.stream]);
  useEffect(() => {
    void peerRef.current?.setDataSaver(media.dataSaver);
  }, [media.dataSaver]);

  // --- Room events -----------------------------------------------------------
  useEffect(() => {
    const onReveal = (s: { me: boolean; peer: boolean; revealed: boolean }) => setReveal(s);
    const onTimer = ({ endsAt }: { endsAt: number }) => setEndsAt(endsAt);
    const onExtend = (s: { me: boolean; peer: boolean }) => setExtend(s);
    const onCard = ({ card }: { card: Icebreaker }) => setCard(card);
    const onConnected = ({ peer }: { peer: PeerInfo }) => {
      addFriend(peer);
      setConnectedPeer(peer);
      showToast(t.connected(peer.name));
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.8 }, colors: ["#7c3aed", "#ec4899", "#a78bfa", "#ffffff"] });
    };
    socket.on("room:reveal:state", onReveal);
    socket.on("room:timer", onTimer);
    socket.on("room:extend:state", onExtend);
    socket.on("room:card", onCard);
    socket.on("room:connected", onConnected);
    return () => {
      socket.off("room:reveal:state", onReveal);
      socket.off("room:timer", onTimer);
      socket.off("room:extend:state", onExtend);
      socket.off("room:card", onCard);
      socket.off("room:connected", onConnected);
    };
  }, [socket, showToast]);

  useEffect(() => {
    const a = setTimeout(() => setIntro(false), INTRO_MS);
    const b = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearTimeout(a);
      clearInterval(b);
    };
  }, []);

  // --- Auto-hiding controls -------------------------------------------------
  const poke = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => {
    hideTimer.current = setTimeout(() => setControls(false), CONTROLS_HIDE_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // --- Actions ---------------------------------------------------------------
  const doReveal = () => {
    if (reveal.me) return;
    socket.emit("room:reveal");
    setReveal((r) => ({ ...r, me: true }));
  };
  const doExtend = () => {
    if (extend.me) return;
    socket.emit("room:extend");
    setExtend((e) => ({ ...e, me: true }));
  };
  const doConnect = () => {
    if (connectPressed) return;
    setConnectPressed(true);
    socket.emit("room:connect");
  };
  const nextLockLeft = Math.max(0, Math.ceil((mountedAt + NEXT_LOCK_MS - now) / 1000));
  const doNext = () => {
    if (nextLockLeft > 0) return;
    socket.emit("room:next");
    joinQueue();
  };
  const doLeave = () => {
    socket.emit("room:leave");
    clearMatch();
  };
  const doReport = (reason: ReportReason) => {
    setReportOpen(false);
    addBlocked(match.peer.deviceId);
    socket.emit("room:report", { reason });
    joinQueue();
  };

  const showExtend = !!endsAt && endsAt - now <= EXTEND_PROMPT_MS && endsAt - now > 0;
  const blurred = !reveal.revealed;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black" onPointerDown={poke} onPointerMove={poke}>
      {/* Remote video */}
      <motion.video
        ref={remoteRef}
        autoPlay
        playsInline
        initial={false}
        animate={{
          filter: blurred ? "blur(70px) saturate(1.3) brightness(0.8)" : "blur(0px) saturate(1) brightness(1)",
          scale: blurred ? 1.25 : 1,
        }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Extra veil while blind: a big blur alone still leaks silhouettes */}
      <motion.div
        initial={false}
        animate={{ opacity: blurred ? 1 : 0 }}
        transition={{ duration: 0.9 }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.25),rgba(11,11,18,0.65))]"
      />
      {connState !== "connected" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
            {t.connecting}
          </motion.span>
        </div>
      )}
      {/* Vignette so overlays stay legible on bright video */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

      {/* Self PiP */}
      <motion.div
        drag
        dragMomentum={false}
        className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-20 aspect-[3/4] w-[28%] max-w-[140px] overflow-hidden rounded-2xl border border-white/15 bg-surface shadow-2xl"
      >
        <video ref={selfRef} autoPlay muted playsInline className="mirror h-full w-full object-cover" />
        {!media.camOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface text-muted">
            <VideoOff size={20} />
          </div>
        )}
      </motion.div>

      {/* Top-left: peer + quality */}
      <div className="absolute left-3 top-[max(12px,env(safe-area-inset-top))] z-20 flex flex-col gap-2">
        <div className="glass flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400 breathe" />
          <span className="text-sm font-bold">{match.peer.name}</span>
          {match.peer.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-fg/80">
              {tag}
            </span>
          ))}
        </div>
        {!!endsAt && (
          <div className="self-start">
            <RoundTimer endsAt={endsAt} />
          </div>
        )}
        <QualityBadge stats={stats} state={connState} />
      </div>

      {/* Bottom: extend prompt + icebreaker + controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-[560px] flex-col gap-3 px-3 pb-[max(14px,env(safe-area-inset-bottom))]">
        <AnimatePresence>
          {showExtend && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="glass flex items-center justify-between gap-3 self-center rounded-full py-2 pl-4 pr-2"
            >
              <span className="text-sm font-semibold">{extend.me ? t.extendWaiting : t.extendAsk(t.duration(EXTEND_MS))}</span>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={doExtend}
                disabled={extend.me}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${extend.me ? "bg-white/10 text-muted" : "grad text-white"}`}
              >
                {t.extendYes(t.duration(EXTEND_MS))}
                {extend.peer && !extend.me ? " (1/2)" : ""}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
        <IcebreakerCard card={card} onNext={() => socket.emit("room:card:next")} />

        <AnimatePresence>
          {controls && hint && (
            <motion.div
              key="hint"
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="glass pointer-events-none self-center rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              {hint}
            </motion.div>
          )}
          {controls && (
            <motion.div
              key="controls"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onPointerLeave={() => setHint(null)}
              className="glass flex items-center justify-between gap-1 rounded-full p-1"
            >
              <Ctl onHover={setHint} onClick={media.toggleMic} active={!media.micOn} label={t.mic}>
                {media.micOn ? <Mic size={20} /> : <MicOff size={20} />}
              </Ctl>
              <Ctl onHover={setHint} onClick={media.toggleCam} active={!media.camOn} label={t.cam}>
                {media.camOn ? <Video size={20} /> : <VideoOff size={20} />}
              </Ctl>
              {!reveal.revealed && (
                <Ctl onHover={setHint} onClick={doReveal} highlight={!reveal.me} label={reveal.me ? t.revealWaiting : t.reveal}>
                  <Eye size={20} />
                  {reveal.peer && !reveal.me && <Dot />}
                </Ctl>
              )}
              <Ctl
                onHover={setHint}
                onClick={doConnect}
                highlight={!!connectedPeer}
                active={connectPressed && !connectedPeer}
                label={connectedPeer ? t.connected(connectedPeer.name) : connectPressed ? t.connectPending : t.connect}
              >
                <motion.span animate={connectedPeer ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.5 }}>
                  <Heart size={20} fill={connectPressed ? "currentColor" : "none"} />
                </motion.span>
              </Ctl>
              <Ctl onHover={setHint} onClick={() => media.setDataSaver(!media.dataSaver)} active={media.dataSaver} label={t.dataSaver}>
                <Leaf size={20} />
              </Ctl>
              <Ctl onHover={setHint} onClick={() => setReportOpen(true)} label={t.report}>
                <Flag size={18} />
              </Ctl>
              {!match.private && (
                <Ctl
                  onHover={setHint}
                  onClick={doNext}
                  label={nextLockLeft > 0 ? t.nextLocked(nextLockLeft) : t.next}
                  highlight={nextLockLeft === 0}
                  active={false}
                >
                  {nextLockLeft > 0 ? (
                    <span className="text-sm font-bold tabular-nums text-muted">{nextLockLeft}</span>
                  ) : (
                    <SkipForward size={20} />
                  )}
                </Ctl>
              )}
              <Ctl onHover={setHint} onClick={doLeave} label={t.leave} danger>
                <PhoneOff size={20} />
              </Ctl>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>{intro && <MatchIntro me={getName()} peer={match.peer.name} />}</AnimatePresence>
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} onReport={doReport} />
      <Toast message={toast} />
    </div>
  );
}

function Dot() {
  return <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent-2 ring-2 ring-bg" />;
}

function Ctl({
  children,
  onClick,
  onHover,
  label,
  active,
  highlight,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onHover: (label: string | null) => void;
  label: string;
  active?: boolean;
  highlight?: boolean;
  danger?: boolean;
}) {
  const cls = danger
    ? "bg-rose-500/90 text-white"
    : highlight
      ? "grad text-white glow"
      : active
        ? "bg-white text-bg"
        : "bg-white/10 text-fg";
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      onPointerEnter={() => onHover(label)}
      onFocus={() => onHover(label)}
      onBlur={() => onHover(null)}
      aria-label={label}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${cls}`}
    >
      {children}
    </motion.button>
  );
}
