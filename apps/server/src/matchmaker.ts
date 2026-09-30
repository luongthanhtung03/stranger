import { REMATCH_COOLDOWN_MS } from "@stranger/shared";
import { createRoom } from "./rooms.js";
import { users, type User } from "./state.js";

const queue: string[] = []; // socket ids, FIFO
const recentPairs = new Map<string, number>(); // "devA|devB" -> ts

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function queueSize() {
  return queue.length;
}

export function enqueue(user: User) {
  if (user.roomId || queue.includes(user.socket.id)) return;
  user.queuedAt = Date.now();
  if (user.priority) {
    user.priority = false;
    queue.unshift(user.socket.id);
  } else {
    queue.push(user.socket.id);
  }
  void tryMatch();
}

export function dequeue(user: User) {
  const i = queue.indexOf(user.socket.id);
  if (i >= 0) queue.splice(i, 1);
  user.queuedAt = null;
}

function compatible(a: User, b: User) {
  if (a.deviceId === b.deviceId) return false;
  if (a.blocked.has(b.deviceId) || b.blocked.has(a.deviceId)) return false;
  const last = recentPairs.get(pairKey(a.deviceId, b.deviceId));
  return !last || Date.now() - last > REMATCH_COOLDOWN_MS;
}

function sharedTags(a: User, b: User) {
  return a.tags.filter((t) => b.tags.includes(t)).length;
}

let matching = false;

/** Pairs the longest-waiting user with the compatible candidate sharing the most tags. */
export async function tryMatch() {
  if (matching) return;
  matching = true;
  try {
    let progressed = true;
    while (progressed && queue.length >= 2) {
      progressed = false;
      const head = users.get(queue[0]);
      if (!head) {
        queue.shift();
        progressed = true;
        continue;
      }
      let best: User | null = null;
      let bestScore = -1;
      for (let i = 1; i < queue.length; i++) {
        const cand = users.get(queue[i]);
        if (!cand) continue;
        if (!compatible(head, cand)) continue;
        const score = sharedTags(head, cand);
        if (score > bestScore) {
          best = cand;
          bestScore = score;
        }
      }
      if (!best) break;
      dequeue(head);
      dequeue(best);
      recentPairs.set(pairKey(head.deviceId, best.deviceId), Date.now());
      await createRoom(head, best, false);
      progressed = true;
    }
  } finally {
    matching = false;
  }
}

// Sweep stale pair history and retry matching (covers races and late arrivals).
setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of recentPairs) if (now - ts > REMATCH_COOLDOWN_MS) recentPairs.delete(k);
  void tryMatch();
}, 2000);
