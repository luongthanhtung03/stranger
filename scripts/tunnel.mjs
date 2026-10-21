// Expose the local dev app to the internet so friends can join from their
// phones. Phones only allow the camera on HTTPS, so this opens two Cloudflare
// quick tunnels (no account needed): one for the web app, one for the
// signaling server, points them at each other, then starts both dev servers.
//
//   npm run tunnel
//   WEB_PORT=3200 SERVER_PORT=4200 npm run tunnel   (if the defaults are busy)
//
// Ctrl+C stops everything and puts the env files back the way they were.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);
const SERVER_PORT = Number(process.env.SERVER_PORT ?? 4000);
const WEB_ENV = path.join(root, "apps/web/.env.local");
const SERVER_ENV = path.join(root, "apps/server/.env");

// Prefer the binary downloaded into .tools/ (no system install needed).
const localBin = path.join(root, ".tools", process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
const CLOUDFLARED = fs.existsSync(localBin) ? localBin : "cloudflared";

const procs = [];

function tunnel(port) {
  return new Promise((resolve, reject) => {
    const p = spawn(CLOUDFLARED, ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    procs.push(p);
    let done = false;
    const onData = (chunk) => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk));
      if (m && !done) {
        done = true;
        resolve(m[0]);
      }
    };
    p.stdout.on("data", onData);
    p.stderr.on("data", onData);
    p.on("error", (e) =>
      reject(
        new Error(
          `cloudflared failed to start (${e.message}). Download it from https://github.com/cloudflare/cloudflared/releases and put cloudflared.exe in .tools/`,
        ),
      ),
    );
    p.on("exit", (code) => !done && reject(new Error(`cloudflared exited with code ${code}`)));
    setTimeout(() => !done && reject(new Error("timed out waiting for a tunnel URL")), 40_000);
  });
}

function setEnv(file, key, value) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  fs.writeFileSync(file, re.test(cur) ? cur.replace(re, line) : `${cur.trimEnd()}\n${line}\n`);
}

// If a previous session was killed without cleanup, the files still point at
// dead tunnels; put them back to localhost before taking the snapshot.
if (fs.existsSync(WEB_ENV) && /trycloudflare\.com/.test(fs.readFileSync(WEB_ENV, "utf8"))) {
  setEnv(WEB_ENV, "NEXT_PUBLIC_SERVER_URL", `http://localhost:${SERVER_PORT}`);
}
if (fs.existsSync(SERVER_ENV) && /trycloudflare\.com/.test(fs.readFileSync(SERVER_ENV, "utf8"))) {
  setEnv(SERVER_ENV, "CORS_ORIGINS", `http://localhost:${WEB_PORT}`);
}

const originals = {
  web: fs.existsSync(WEB_ENV) ? fs.readFileSync(WEB_ENV, "utf8") : null,
  server: fs.existsSync(SERVER_ENV) ? fs.readFileSync(SERVER_ENV, "utf8") : null,
};

let closing = false;
function cleanup() {
  if (closing) return;
  closing = true;
  for (const p of procs) {
    try {
      p.kill();
    } catch {
      /* already gone */
    }
  }
  if (originals.web !== null) fs.writeFileSync(WEB_ENV, originals.web);
  if (originals.server !== null) fs.writeFileSync(SERVER_ENV, originals.server);
  console.log("\nTunnels closed, env files restored.");
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

console.log("Opening Cloudflare tunnels…");
const [webUrl, serverUrl] = await Promise.all([tunnel(WEB_PORT), tunnel(SERVER_PORT)]);

// Written to the env files too, so `npm run dev` on its own keeps working
// while this session is up; restored on exit.
setEnv(WEB_ENV, "NEXT_PUBLIC_SERVER_URL", serverUrl);
setEnv(SERVER_ENV, "CORS_ORIGINS", `http://localhost:${WEB_PORT},${webUrl}`);

console.log(`
┌──────────────────────────────────────────────────────┐
  Share this link with your friends:

  ${webUrl}

  (server: ${serverUrl})
  Keep this window open. Ctrl+C to stop.
└──────────────────────────────────────────────────────┘
`);

const shell = true; // resolves npm/npx on Windows
const web = spawn("npx", ["next", "dev", "-p", String(WEB_PORT)], {
  cwd: path.join(root, "apps/web"),
  stdio: "inherit",
  shell,
  env: { ...process.env, NEXT_PUBLIC_SERVER_URL: serverUrl },
});
const server = spawn("npx", ["tsx", "watch", "src/index.ts"], {
  cwd: path.join(root, "apps/server"),
  stdio: "inherit",
  shell,
  env: { ...process.env, PORT: String(SERVER_PORT), CORS_ORIGINS: `http://localhost:${WEB_PORT},${webUrl}` },
});
procs.push(web, server);
web.on("exit", cleanup);
server.on("exit", cleanup);
