// Integration test for the signaling server: matching, cards, reveal, extend,
// connect, next, report/ban, friend invites. Run with the server on PORT.
import { io } from "socket.io-client";
import { EXTEND_MS, ROUND_MS, SKIP_LIMIT } from "@stranger/shared";

const URL = process.env.URL ?? "http://localhost:4010";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};
const once = (s, ev, ms = 3000) =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting ${ev}`)), ms);
    s.once(ev, (p) => {
      clearTimeout(t);
      res(p);
    });
  });

function client(name, tags = [], blocked = []) {
  const s = io(URL, { transports: ["websocket"] });
  const deviceId = `dev-${name}-${Math.random().toString(36).slice(2, 8)}`;
  s.on("connect", () => s.emit("hello", { deviceId, name, tags, blocked }));
  s.deviceId = deviceId;
  return s;
}

// --- 1. matching + room events ---------------------------------------------
const a = client("An", ["game"]);
const b = client("Bình", ["game"]);
await wait(300);
const [ma, mb] = await Promise.all([once(a, "room:matched"), once(b, "room:matched"), a.emit("queue:join"), b.emit("queue:join")]);
ok(ma.roomId === mb.roomId, "both get the same room");
ok(ma.initiator !== mb.initiator, "exactly one initiator");
ok(ma.peer.name === "Bình" && mb.peer.name === "An", "peer info exchanged");
ok(Array.isArray(ma.iceServers) && ma.iceServers.length > 0, "ice servers provided");
ok(ma.endsAt > Date.now() + ROUND_MS - 2000, "round timer set");

ok(ma.card && ma.card.id === mb.card.id, "same first icebreaker card for both (in room:matched)");
const ca = { card: ma.card };

// signaling relay
b.once("rtc:signal", (sig) => ok(sig.type === "ice" && sig.candidate.candidate === "x", "rtc:signal relayed to peer"));
a.emit("rtc:signal", { type: "ice", candidate: { candidate: "x" } });
await wait(200);

// reveal handshake
a.emit("room:reveal");
const r1 = await once(b, "room:reveal:state");
ok(r1.peer === true && r1.me === false && r1.revealed === false, "one-sided reveal not revealed yet");
b.emit("room:reveal");
const r2 = await once(a, "room:reveal:state");
ok(r2.revealed === true, "both reveal → revealed");

// extend handshake
a.emit("room:extend");
const e1 = await once(b, "room:extend:state");
ok(e1.peer === true && !e1.me, "extend state shows peer pressed");
b.emit("room:extend");
const t2 = await once(a, "room:timer");
ok(t2.endsAt > ma.endsAt + EXTEND_MS - 2000, "timer extended");

// connect: one-sided invisible, both → connected
let leaked = false;
b.once("room:connected", () => (leaked = true));
a.emit("room:connect");
await wait(300);
ok(!leaked, "one-sided connect invisible to peer");
b.emit("room:connect");
const [cna, cnb] = await Promise.all([once(a, "room:connected"), once(b, "room:connected")]);
ok(cna.peer.deviceId === b.deviceId && cnb.peer.deviceId === a.deviceId, "both receive room:connected with peer info");

// next card
const nc = once(b, "room:card");
a.emit("room:card:next");
const ncb = await nc;
ok(ncb.card.id !== ca.card.id, "card:next sends a different card");

// next → peer sees peer-next, actor sees you-left
const endB = once(b, "room:ended");
const endA = once(a, "room:ended");
a.emit("room:next");
const [ea, eb] = await Promise.all([endA, endB]);
ok(ea.reason === "you-left" && eb.reason === "peer-next", "room:next end reasons");

// no immediate rematch of the same pair
let rematched = false;
a.once("room:matched", () => (rematched = true));
a.emit("queue:join");
b.emit("queue:join");
await wait(600);
ok(!rematched, "same pair not rematched within cooldown");
a.emit("queue:leave");
b.emit("queue:leave");

// --- 2. friend invite → private room ----------------------------------------
const invP = once(b, "friend:invite");
a.emit("friend:invite", { deviceId: b.deviceId });
const inv = await invP;
ok(inv.from.deviceId === a.deviceId, "friend invite delivered");
const [pa, pb] = await Promise.all([once(a, "room:matched"), once(b, "room:matched"), b.emit("friend:accept", { inviteId: inv.inviteId })]);
ok(pa.private && pb.private && pa.endsAt === 0, "private room without timer");
a.emit("room:leave");
await once(b, "room:ended");

// friend status
b.emit("friend:status", { deviceIds: [a.deviceId, "nobody"] });
const st = await once(b, "friend:status");
ok(st.online[a.deviceId] === true && st.online["nobody"] === false, "friend:status reports online map");

// --- 3. reports → ban after 3 distinct reporters ----------------------------
const victim = client("Vic");
await wait(200);
let bannedPayload = null;
victim.on("banned", (p) => (bannedPayload = p));
for (let i = 0; i < 3; i++) {
  const rep = client(`Rep${i}`);
  await wait(200);
  const m = Promise.all([once(rep, "room:matched"), once(victim, "room:matched")]);
  rep.emit("queue:join");
  victim.emit("queue:join");
  await m;
  rep.emit("room:report", { reason: "spam" });
  await once(victim, "room:ended");
  rep.disconnect();
  await wait(100);
}
await wait(300);
ok(bannedPayload && bannedPayload.until > Date.now(), "3 reports → banned");
const again = io(URL, { transports: ["websocket"] });
again.on("connect", () => again.emit("hello", { deviceId: victim.deviceId, name: "Vic", tags: [], blocked: [] }));
const b2 = await once(again, "banned");
ok(b2.until > Date.now(), "banned device rejected on reconnect");

// --- 4. blocked list skips matching -----------------------------------------
const x = client("X");
await wait(200);
const y = client("Y", [], [x.deviceId]);
await wait(200);
let xy = false;
x.once("room:matched", () => (xy = true));
x.emit("queue:join");
y.emit("queue:join");
await wait(600);
ok(!xy, "blocked pair is never matched");
x.disconnect();
y.disconnect();
await wait(200);

// --- 5. skip spam -> cooldown, skipped person gets priority ------------------
const skipper = client("Skippy");
await wait(200);
let cooldown = null;
skipper.on("queue:cooldown", (p) => (cooldown = p));
for (let i = 0; i < SKIP_LIMIT; i++) {
  const other = client(`Other${i}`);
  await wait(200);
  const m = Promise.all([once(skipper, "room:matched"), once(other, "room:matched")]);
  skipper.emit("queue:join");
  other.emit("queue:join");
  await m;
  const ended = once(other, "room:ended");
  skipper.emit("room:next");
  const e = await ended;
  ok(e.reason === "peer-next", `skipped person ${i + 1} sees peer-next`);
  other.disconnect();
  await wait(100);
}
skipper.emit("queue:join");
await wait(300);
ok(cooldown && cooldown.until > Date.now(), "skip spam -> queue:cooldown");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
