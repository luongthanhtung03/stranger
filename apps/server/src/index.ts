import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import {
  GAME_IDS,
  NAME_MAX,
  SKIP_COOLDOWN_MS,
  SKIP_LIMIT,
  SKIP_WINDOW_MS,
  TAGS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@stranger/shared";
import { dequeue, enqueue, queueSize } from "./matchmaker.js";
import { banUntil, report } from "./moderation.js";
import {
  createRoom,
  endRoom,
  handleCardNext,
  handleConnect,
  handleExtend,
  handleReveal,
  roomOf,
} from "./rooms.js";
import { peerOf, publicInfo, socketByDevice, userByDevice, users, type User } from "./state.js";

const PORT = Number(process.env.PORT ?? 4000);
const ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim());

const app = express();
app.use(cors({ origin: ORIGINS }));
app.get("/healthz", (_req, res) => res.json({ ok: true, online: users.size, waiting: queueSize() }));

const http = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
  cors: { origin: ORIGINS },
});

let presenceTimer: NodeJS.Timeout | null = null;
function broadcastPresence() {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = null;
    io.emit("presence", { online: users.size, waiting: queueSize() });
  }, 500);
}

const invites = new Map<string, { from: string; to: string; at: number }>(); // inviteId -> device ids
const skips = new Map<string, number[]>(); // deviceId -> recent "next" timestamps
const cooldowns = new Map<string, number>(); // deviceId -> until

/** Records a skip; returns the cooldown expiry if this one crossed the limit. */
function noteSkip(deviceId: string): number | null {
  const now = Date.now();
  const list = (skips.get(deviceId) ?? []).filter((t) => now - t < SKIP_WINDOW_MS);
  list.push(now);
  skips.set(deviceId, list);
  if (list.length < SKIP_LIMIT) return null;
  skips.set(deviceId, []);
  const until = now + SKIP_COOLDOWN_MS;
  cooldowns.set(deviceId, until);
  return until;
}

function cleanName(raw: string) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return name || "Người lạ";
}

io.on("connection", (socket) => {
  socket.on("hello", ({ deviceId, name, tags, blocked }) => {
    if (typeof deviceId !== "string" || deviceId.length < 8 || deviceId.length > 64) {
      socket.disconnect(true);
      return;
    }
    const until = banUntil(deviceId);
    if (until) {
      socket.emit("banned", { until });
      socket.disconnect(true);
      return;
    }
    // A device reconnecting replaces its older socket.
    const oldSid = socketByDevice.get(deviceId);
    if (oldSid && oldSid !== socket.id) users.get(oldSid)?.socket.disconnect(true);

    const user: User = {
      socket,
      deviceId,
      name: cleanName(name),
      tags: (Array.isArray(tags) ? tags : []).filter((t) => (TAGS as readonly string[]).includes(t)),
      blocked: new Set(Array.isArray(blocked) ? blocked.slice(0, 500) : []),
      roomId: null,
      queuedAt: null,
      priority: false,
      cooldownTimer: null,
      game: null,
    };
    users.set(socket.id, user);
    socketByDevice.set(deviceId, socket.id);
    broadcastPresence();
  });

  const me = () => users.get(socket.id);

  socket.on("queue:join", () => {
    const u = me();
    if (!u) return;
    const until = cooldowns.get(u.deviceId) ?? 0;
    if (until > Date.now()) {
      // Fast skipper: hold them for a bit, then queue them automatically.
      socket.emit("queue:cooldown", { until });
      if (u.cooldownTimer) clearTimeout(u.cooldownTimer);
      u.cooldownTimer = setTimeout(() => {
        u.cooldownTimer = null;
        if (users.get(socket.id) === u && !u.roomId) {
          enqueue(u);
          broadcastPresence();
        }
      }, until - Date.now());
      return;
    }
    enqueue(u);
    broadcastPresence();
  });

  socket.on("game:score", ({ game, score }) => {
    const u = me();
    if (!u || !GAME_IDS.includes(game) || typeof score !== "number") return;
    u.game = { game, score: Math.max(-9999, Math.min(9999, Math.floor(score))) };
  });

  socket.on("queue:leave", () => {
    const u = me();
    if (!u) return;
    dequeue(u);
    broadcastPresence();
  });

  socket.on("rtc:signal", (signal) => {
    const u = me();
    const room = u && roomOf(u);
    if (!room) return;
    users.get(peerOf(room, socket.id))?.socket.emit("rtc:signal", signal);
  });

  socket.on("room:reveal", () => me() && handleReveal(me()!));
  socket.on("room:extend", () => me() && handleExtend(me()!));
  socket.on("room:connect", () => me() && handleConnect(me()!));
  socket.on("room:card:next", () => me() && handleCardNext(me()!));

  socket.on("room:next", () => {
    const u = me();
    const room = u && roomOf(u);
    if (!u || !room) return;
    endRoom(room, "you-left", "peer-next", socket.id);
    noteSkip(u.deviceId);
    broadcastPresence();
  });

  socket.on("room:leave", () => {
    const u = me();
    const room = u && roomOf(u);
    if (room) endRoom(room, "you-left", "peer-left", socket.id);
    broadcastPresence();
  });

  socket.on("room:report", () => {
    const u = me();
    const room = u && roomOf(u);
    if (!u || !room) return;
    const target = users.get(peerOf(room, socket.id));
    endRoom(room, "reported", "peer-left", socket.id);
    if (!target) return;
    const until = report(u.deviceId, target.deviceId);
    if (until) {
      target.socket.emit("banned", { until });
      target.socket.disconnect(true);
    }
  });

  socket.on("friend:invite", ({ deviceId }) => {
    const u = me();
    if (!u || u.roomId) return;
    const target = userByDevice(deviceId);
    if (!target || target.roomId || target.blocked.has(u.deviceId)) return;
    const inviteId = randomUUID();
    invites.set(inviteId, { from: u.deviceId, to: target.deviceId, at: Date.now() });
    target.socket.emit("friend:invite", { inviteId, from: publicInfo(u) });
    setTimeout(() => {
      if (!invites.delete(inviteId)) return;
      userByDevice(u.deviceId)?.socket.emit("friend:invite:result", { inviteId, accepted: false });
    }, 30_000);
  });

  socket.on("friend:accept", async ({ inviteId }) => {
    const inv = invites.get(inviteId);
    const u = me();
    if (!inv || !u || inv.to !== u.deviceId) return;
    invites.delete(inviteId);
    const from = userByDevice(inv.from);
    if (!from || from.roomId || u.roomId) {
      from?.socket.emit("friend:invite:result", { inviteId, accepted: false });
      return;
    }
    dequeue(from);
    dequeue(u);
    from.socket.emit("friend:invite:result", { inviteId, accepted: true });
    await createRoom(from, u, true);
    broadcastPresence();
  });

  socket.on("friend:decline", ({ inviteId }) => {
    const inv = invites.get(inviteId);
    if (!inv || inv.to !== me()?.deviceId) return;
    invites.delete(inviteId);
    userByDevice(inv.from)?.socket.emit("friend:invite:result", { inviteId, accepted: false });
  });

  socket.on("friend:status", ({ deviceIds }) => {
    const online: Record<string, boolean> = {};
    for (const id of (deviceIds ?? []).slice(0, 200)) online[id] = !!userByDevice(id);
    socket.emit("friend:status", { online });
  });

  socket.on("disconnect", () => {
    const u = me();
    if (!u) return;
    dequeue(u);
    if (u.cooldownTimer) clearTimeout(u.cooldownTimer);
    const room = roomOf(u);
    if (room) endRoom(room, "you-left", "peer-disconnected", socket.id);
    users.delete(socket.id);
    if (socketByDevice.get(u.deviceId) === socket.id) socketByDevice.delete(u.deviceId);
    broadcastPresence();
  });
});

http.listen(PORT, () => {
  console.log(`[stranger] signaling server on :${PORT}, origins: ${ORIGINS.join(", ")}`);
});
