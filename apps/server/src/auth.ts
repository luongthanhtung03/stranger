import { createHmac, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { ALLOWED_EMAIL_SUFFIX, SESSION_MS, type AuthResult } from "@stranger/shared";

// Google sign-in, limited to student emails (.edu.vn). OFF unless AUTH_ENABLED=true:
// the public beta runs without accounts. When on, the client trades a Google ID
// token for our own HMAC-signed session (Google tokens expire after an hour),
// and the account id replaces the deviceId, so bans follow the person.

// Read lazily: index.ts loads `.env` after the imports have been evaluated.
let cfg: { enabled: boolean; clientId: string; secret: string; google: OAuth2Client } | null = null;
function config() {
  if (cfg) return cfg;
  const enabled = process.env.AUTH_ENABLED === "true";
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  if (enabled && (!clientId || secret.length < 32)) {
    throw new Error("AUTH_ENABLED needs GOOGLE_CLIENT_ID and a SESSION_SECRET of 32+ chars");
  }
  cfg = { enabled, clientId, secret, google: new OAuth2Client(clientId) };
  return cfg;
}

export const authEnabled = () => config().enabled;

export interface Session {
  /** Stable account id; used as the deviceId for signed-in users. */
  uid: string;
  email: string;
  exp: number;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", config().secret).update(body).digest("base64url");

export function signSession(s: Session): string {
  const body = b64(JSON.stringify(s));
  return `${body}.${sign(body)}`;
}

export function verifySession(token: unknown): Session | null {
  if (!authEnabled() || typeof token !== "string" || token.length > 1024) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    return typeof s.uid === "string" && s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function isStudentEmail(email: string) {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return domain.endsWith(ALLOWED_EMAIL_SUFFIX) && domain.length > ALLOWED_EMAIL_SUFFIX.length;
}

export async function signInWithGoogle(credential: unknown): Promise<AuthResult> {
  const { enabled, clientId, google } = config();
  if (!enabled) return { ok: false, error: "disabled" };
  if (typeof credential !== "string" || credential.length > 4096) return { ok: false, error: "invalid" };
  let payload;
  try {
    payload = (await google.verifyIdToken({ idToken: credential, audience: clientId })).getPayload();
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (!payload?.sub || !payload.email || !payload.email_verified) return { ok: false, error: "invalid" };
  if (!isStudentEmail(payload.email)) return { ok: false, error: "domain" };
  const session = signSession({ uid: `g:${payload.sub}`, email: payload.email, exp: Date.now() + SESSION_MS });
  return { ok: true, session, email: payload.email, name: payload.name ?? "" };
}
