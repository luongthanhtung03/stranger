import { randomUUID } from "node:crypto";
import {
  CARD_INTERVAL_MS,
  EXTEND_MS,
  ROUND_MS,
  gameResultText,
  type Icebreaker,
  type RoomEndReason,
} from "@stranger/shared";
import { pickCard } from "./icebreakers.js";
import { getIceServers } from "./turn.js";
import { peerOf, publicInfo, rooms, users, type Room, type User } from "./state.js";

const lastCard = new Map<string, string>(); // roomId -> card id

export async function createRoom(a: User, b: User, isPrivate: boolean): Promise<Room> {
  const room: Room = {
    id: randomUUID(),
    members: [a.socket.id, b.socket.id],
    private: isPrivate,
    endsAt: isPrivate ? 0 : Date.now() + ROUND_MS,
    reveal: new Set(),
    extend: new Set(),
    connect: new Set(),
    endTimer: null,
    cardTimer: null,
  };
  rooms.set(room.id, room);
  a.roomId = room.id;
  b.roomId = room.id;
  a.queuedAt = null;
  b.queuedAt = null;

  const iceServers = await getIceServers();
  // The first card rides along with the match: a separate event right after
  // would arrive before the client's room listeners exist.
  const card = pickCard();
  lastCard.set(room.id, card.id);
  room.cardTimer = setInterval(() => sendCard(room), CARD_INTERVAL_MS);
  const base = { roomId: room.id, iceServers, endsAt: room.endsAt, private: isPrivate };
  // A mini-game result from the queue beats the random card as an opener.
  a.socket.emit("room:matched", { ...base, card: braggingCard(b) ?? card, peer: publicInfo(b), initiator: true });
  b.socket.emit("room:matched", { ...base, card: braggingCard(a) ?? card, peer: publicInfo(a), initiator: false });
  a.game = null;
  b.game = null;

  scheduleEnd(room);
  return room;
}

function braggingCard(u: User): Icebreaker | null {
  const text = u.game && gameResultText(u.name, u.game);
  return text ? { id: `game-${u.deviceId}`, category: "funny", text } : null;
}

function scheduleEnd(room: Room) {
  if (room.endTimer) clearTimeout(room.endTimer);
  room.endTimer = null;
  if (!room.endsAt) return;
  room.endTimer = setTimeout(() => endRoom(room, "timer", "timer"), room.endsAt - Date.now());
}

function sendCard(room: Room) {
  if (room.cardTimer) clearInterval(room.cardTimer);
  const card = pickCard(lastCard.get(room.id));
  lastCard.set(room.id, card.id);
  emitBoth(room, (s) => s.emit("room:card", { card }));
  room.cardTimer = setInterval(() => sendCard(room), CARD_INTERVAL_MS);
}

function emitBoth(room: Room, fn: (s: User["socket"]) => void) {
  for (const sid of room.members) {
    const u = users.get(sid);
    if (u) fn(u.socket);
  }
}

/** Ends the room. `reasonFor` is what the acting user sees, `reasonPeer` what the other sees. */
export function endRoom(
  room: Room,
  reasonFor: RoomEndReason,
  reasonPeer: RoomEndReason,
  actorId?: string,
) {
  if (!rooms.has(room.id)) return;
  rooms.delete(room.id);
  lastCard.delete(room.id);
  if (room.endTimer) clearTimeout(room.endTimer);
  if (room.cardTimer) clearInterval(room.cardTimer);
  for (const sid of room.members) {
    const u = users.get(sid);
    if (!u) continue;
    u.roomId = null;
    const reason = sid === actorId ? reasonFor : reasonPeer;
    if (reason === "peer-next") u.priority = true; // being skipped shouldn't also mean waiting longest
    u.socket.emit("room:ended", { reason });
  }
}

export function roomOf(user: User): Room | undefined {
  return user.roomId ? rooms.get(user.roomId) : undefined;
}

export function handleReveal(user: User) {
  const room = roomOf(user);
  if (!room) return;
  room.reveal.add(user.socket.id);
  const revealed = room.reveal.size === 2;
  for (const sid of room.members) {
    users.get(sid)?.socket.emit("room:reveal:state", {
      me: room.reveal.has(sid),
      peer: room.reveal.has(peerOf(room, sid)),
      revealed,
    });
  }
}

export function handleExtend(user: User) {
  const room = roomOf(user);
  if (!room || !room.endsAt) return;
  room.extend.add(user.socket.id);
  if (room.extend.size === 2) {
    room.extend.clear();
    room.endsAt = Math.max(room.endsAt, Date.now()) + EXTEND_MS;
    scheduleEnd(room);
    emitBoth(room, (s) => {
      s.emit("room:timer", { endsAt: room.endsAt });
      s.emit("room:extend:state", { me: false, peer: false });
    });
    return;
  }
  for (const sid of room.members) {
    users.get(sid)?.socket.emit("room:extend:state", {
      me: room.extend.has(sid),
      peer: room.extend.has(peerOf(room, sid)),
    });
  }
}

export function handleConnect(user: User) {
  const room = roomOf(user);
  if (!room) return;
  room.connect.add(user.socket.id);
  if (room.connect.size < 2) return; // one-sided presses stay invisible
  for (const sid of room.members) {
    const me = users.get(sid);
    const peer = users.get(peerOf(room, sid));
    if (me && peer) me.socket.emit("room:connected", { peer: publicInfo(peer) });
  }
}

export function handleCardNext(user: User) {
  const room = roomOf(user);
  if (room) sendCard(room);
}
