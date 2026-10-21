// Login (hidden in the beta). Run against a server started with:
//   AUTH_ENABLED=true GOOGLE_CLIENT_ID=test.apps.googleusercontent.com \
//   SESSION_SECRET=<same as below> PORT=4011 npx tsx src/index.ts
// then: SESSION_SECRET=<same> npx tsx test/auth.test.mjs
import { createHmac } from "node:crypto";
import { io } from "socket.io-client";

const URL = process.env.URL ?? "http://localhost:4011";
const SECRET = process.env.SESSION_SECRET ?? "";
if (SECRET.length < 32) throw new Error("set SESSION_SECRET (same as the server's)");
process.env.AUTH_ENABLED = "true";
process.env.GOOGLE_CLIENT_ID = "test.apps.googleusercontent.com";
const { isStudentEmail } = await import("../src/auth.ts");

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev, ms = 3000) =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting ${ev}`)), ms);
    s.once(ev, (p) => {
      clearTimeout(t);
      res(p);
    });
  });

function session(uid, exp = Date.now() + 60_000, secret = SECRET) {
  const body = Buffer.from(JSON.stringify({ uid, email: `${uid}@vnu.edu.vn`, exp })).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

function client(name, sess) {
  const s = io(URL, { transports: ["websocket"] });
  s.on("connect", () =>
    s.emit("hello", { deviceId: `dev-${name}-${Math.random().toString(36).slice(2)}`, name, tags: [], school: null, blocked: [], session: sess }),
  );
  return s;
}

// --- email rule ---------------------------------------------------------------
ok(isStudentEmail("21020001@vnu.edu.vn"), "vnu.edu.vn accepted");
ok(isStudentEmail("a@sv.hust.edu.vn"), "subdomain .edu.vn accepted");
ok(!isStudentEmail("a@gmail.com"), "gmail rejected");
ok(!isStudentEmail("a@fakeedu.vn"), "lookalike domain rejected");
ok(!isStudentEmail("a.edu.vn@gmail.com"), ".edu.vn in local part rejected");

// --- no / bad session -> auth:required, user not registered -------------------
for (const [label, sess] of [
  ["no session", null],
  ["forged session", session("g:110248495921238986666", Date.now() + 60_000, "x".repeat(40))],
  ["expired session", session("g:110248495921238986777", Date.now() - 1000)],
  ["garbage session", "abc.def"],
]) {
  const c = client("Anon", sess);
  await once(c, "auth:required").then(
    () => ok(true, `${label} -> auth:required`),
    () => ok(false, `${label} -> auth:required`),
  );
  let matched = false;
  c.once("room:matched", () => (matched = true));
  c.emit("queue:join");
  await wait(200);
  ok(!matched, `${label} cannot queue`);
  c.disconnect();
}

// --- bad Google credential ------------------------------------------------------
const g = io(URL, { transports: ["websocket"] });
await once(g, "connect");
const res = await g.timeout(5000).emitWithAck("auth:google", { credential: "not-a-jwt" });
ok(res.ok === false && res.error === "invalid", "junk Google credential -> invalid");
g.disconnect();

// --- valid sessions: account id replaces deviceId -------------------------------
const a = client("An", session("g:110248495921238986001"));
const b = client("Binh", session("g:110248495921238986002"));
await wait(300);
const [ma] = await Promise.all([once(a, "room:matched"), once(b, "room:matched"), a.emit("queue:join"), b.emit("queue:join")]);
ok(ma.peer.deviceId === "g:110248495921238986002", "signed-in users matched; peer identified by account id");
a.disconnect();
b.disconnect();

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
