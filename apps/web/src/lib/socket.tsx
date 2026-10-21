"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AuthResult,
  ClientToServerEvents,
  IceServer,
  PeerInfo,
  RoomEndReason,
  ServerToClientEvents,
} from "@stranger/shared";
import { getAccount, getBlocked, getDeviceId, getName, getSchool, getTags, setAccount } from "./identity";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface Match {
  roomId: string;
  peer: PeerInfo;
  initiator: boolean;
  iceServers: IceServer[];
  endsAt: number;
  private: boolean;
  brag: string | null;
}

export interface Invite {
  inviteId: string;
  from: PeerInfo;
}

interface Ctx {
  socket: AppSocket;
  connected: boolean;
  presence: { online: number; waiting: number };
  bannedUntil: number | null;
  match: Match | null;
  queued: boolean;
  lastEnd: { reason: RoomEndReason; wasPrivate: boolean; at: number } | null;
  invite: Invite | null;
  cooldownUntil: number | null;
  /** Login is on and we have no valid session (always false in the beta). */
  authRequired: boolean;
  /** Trades a Google ID token for a session, stores it and re-sends `hello`. */
  signInWithGoogle: (credential: string) => Promise<AuthResult>;
  signOut: () => void;
  /** (Re)connects and sends `hello` with the current identity. */
  connect: () => void;
  joinQueue: () => void;
  leaveQueue: () => void;
  clearMatch: () => void;
  dismissInvite: () => void;
}

const SocketCtx = createContext<Ctx | null>(null);

const URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

function sendHello(socket: AppSocket) {
  socket.emit("hello", {
    deviceId: getDeviceId(),
    name: getName(),
    tags: getTags(),
    school: getSchool(),
    blocked: getBlocked(),
    session: getAccount()?.session ?? null,
  });
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socket = useMemo<AppSocket>(
    () => io(URL, { autoConnect: false, transports: ["websocket", "polling"] }),
    [],
  );
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState({ online: 0, waiting: 0 });
  const [bannedUntil, setBannedUntil] = useState<number | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [queued, setQueued] = useState(false);
  const [lastEnd, setLastEnd] = useState<Ctx["lastEnd"]>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const matchRef = useRef<Match | null>(null);
  const queuedRef = useRef(false);

  useEffect(() => {
    const hello = () => sendHello(socket);

    const onConnect = () => {
      setConnected(true);
      hello();
      // A reconnect drops server-side queue/room state; rejoin if we were waiting.
      if (queuedRef.current) socket.emit("queue:join");
      if (matchRef.current) {
        matchRef.current = null;
        setMatch(null);
        setLastEnd({ reason: "peer-disconnected", wasPrivate: false, at: Date.now() });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onPresence = (p: { online: number; waiting: number }) => setPresence(p);
    const onBanned = ({ until }: { until: number }) => {
      setBannedUntil(until);
      queuedRef.current = false;
      setQueued(false);
    };
    const onMatched = (m: Match) => {
      matchRef.current = m;
      queuedRef.current = false;
      setQueued(false);
      setMatch(m);
      setLastEnd(null);
      setInvite(null);
      setCooldownUntil(null);
      try {
        navigator.vibrate?.(30);
      } catch {
        /* no haptics */
      }
    };
    const onEnded = ({ reason }: { reason: RoomEndReason }) => {
      const wasPrivate = matchRef.current?.private ?? false;
      matchRef.current = null;
      setMatch(null);
      setLastEnd({ reason, wasPrivate, at: Date.now() });
    };
    const onInvite = (inv: Invite) => setInvite(inv);
    const onCooldown = ({ until }: { until: number }) => setCooldownUntil(until);
    const onAuthRequired = () => {
      setAccount(null); // missing or expired: drop it so the sign-in button shows
      setAuthRequired(true);
      queuedRef.current = false;
      setQueued(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("presence", onPresence);
    socket.on("banned", onBanned);
    socket.on("room:matched", onMatched);
    socket.on("room:ended", onEnded);
    socket.on("friend:invite", onInvite);
    socket.on("queue:cooldown", onCooldown);
    socket.on("auth:required", onAuthRequired);
    return () => {
      socket.off("auth:required", onAuthRequired);
      socket.off("queue:cooldown", onCooldown);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("presence", onPresence);
      socket.off("banned", onBanned);
      socket.off("room:matched", onMatched);
      socket.off("room:ended", onEnded);
      socket.off("friend:invite", onInvite);
    };
  }, [socket]);

  const connect = useCallback(() => {
    if (socket.connected) {
      sendHello(socket);
    } else {
      socket.connect();
    }
  }, [socket]);

  const joinQueue = useCallback(() => {
    queuedRef.current = true;
    setQueued(true);
    setLastEnd(null);
    if (socket.connected) socket.emit("queue:join");
    else socket.connect();
  }, [socket]);

  const leaveQueue = useCallback(() => {
    queuedRef.current = false;
    setQueued(false);
    socket.emit("queue:leave");
  }, [socket]);

  const clearMatch = useCallback(() => {
    matchRef.current = null;
    setMatch(null);
    setLastEnd(null);
  }, []);

  const dismissInvite = useCallback(() => setInvite(null), []);

  const signInWithGoogle = useCallback(
    async (credential: string): Promise<AuthResult> => {
      if (!socket.connected) socket.connect();
      let res: AuthResult;
      try {
        res = await socket.timeout(10_000).emitWithAck("auth:google", { credential });
      } catch {
        return { ok: false, error: "invalid" };
      }
      if (res.ok) {
        setAccount({ session: res.session, email: res.email });
        setAuthRequired(false);
        sendHello(socket);
      }
      return res;
    },
    [socket],
  );

  const signOut = useCallback(() => {
    setAccount(null);
    setAuthRequired(true);
    socket.disconnect(); // the server forgets us; reconnecting asks for a session again
  }, [socket]);

  const value: Ctx = {
    socket,
    connected,
    presence,
    bannedUntil,
    match,
    queued,
    lastEnd,
    invite,
    cooldownUntil,
    authRequired,
    signInWithGoogle,
    signOut,
    connect,
    joinQueue,
    leaveQueue,
    clearMatch,
    dismissInvite,
  };
  return <SocketCtx.Provider value={value}>{children}</SocketCtx.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketCtx);
  if (!ctx) throw new Error("useSocket outside SocketProvider");
  return ctx;
}
