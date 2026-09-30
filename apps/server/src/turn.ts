import type { IceServer } from "@stranger/shared";

// Cloudflare Realtime TURN: short-lived credentials minted server-side so the
// key token never reaches the browser. Free tier: 1,000 GB/month.
// https://developers.cloudflare.com/realtime/turn/

const STUN_ONLY: IceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];

const TTL_S = 2 * 60 * 60; // credential lifetime
const CACHE_MS = 30 * 60 * 1000; // reuse the same credential for a while

let cached: { servers: IceServer[]; at: number } | null = null;

export async function getIceServers(): Promise<IceServer[]> {
  const keyId = process.env.CF_TURN_KEY_ID;
  const token = process.env.CF_TURN_KEY_TOKEN;
  if (!keyId || !token) return STUN_ONLY;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.servers;

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL_S }),
      },
    );
    if (!res.ok) throw new Error(`TURN ${res.status}`);
    const data = (await res.json()) as { iceServers: IceServer | IceServer[] };
    const list = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
    cached = { servers: [...STUN_ONLY, ...list], at: Date.now() };
    return cached.servers;
  } catch (err) {
    console.warn("[turn] falling back to STUN only:", (err as Error).message);
    return STUN_ONLY;
  }
}
