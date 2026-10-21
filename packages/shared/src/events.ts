// Socket.IO event contracts shared by apps/web and apps/server.
import type { GameScore } from "./games";

export type Tag = string;

export interface PeerInfo {
  deviceId: string;
  name: string;
  tags: Tag[];
  /** Self-picked id from SCHOOLS; unverified until student login exists. */
  school: string | null;
}

export type FriendStatus = "online" | "busy" | "offline";

/** Answer to `auth:google`. `domain` = not a student (.edu.vn) email. */
export type AuthResult =
  | { ok: true; session: string; email: string; name: string }
  | { ok: false; error: "disabled" | "invalid" | "domain" };

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type RtcSignal =
  | { type: "sdp"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

export type ReportReason = "nsfw" | "harass" | "spam" | "other";

export type RoomEndReason =
  | "peer-left"
  | "peer-next"
  | "timer"
  | "you-left"
  | "peer-disconnected"
  | "reported";

/** Events the client emits to the server. */
export interface ClientToServerEvents {
  hello: (payload: {
    deviceId: string;
    name: string;
    tags: Tag[];
    school: string | null;
    blocked: string[];
    /** Server-signed session from `auth:google`; only checked when login is on. */
    session?: string | null;
  }) => void;
  /** Exchange a Google ID token (from Google Identity Services) for a session. */
  "auth:google": (payload: { credential: string }, ack: (result: AuthResult) => void) => void;
  "queue:join": () => void;
  /** Latest mini-game result while waiting; shown to the partner as the first chat line. */
  "game:score": (payload: GameScore) => void;
  "queue:leave": () => void;
  "rtc:signal": (signal: RtcSignal) => void;
  "room:reveal": () => void;
  "room:extend": () => void;
  "room:connect": () => void;
  "room:next": () => void;
  "room:leave": () => void;
  "room:report": (payload: { reason: ReportReason }) => void;
  "room:chat": (payload: { text: string }) => void;
  "friend:invite": (payload: { deviceId: string }) => void;
  "friend:accept": (payload: { inviteId: string }) => void;
  "friend:decline": (payload: { inviteId: string }) => void;
  "friend:status": (payload: { deviceIds: string[] }) => void;
}

/** Events the server emits to the client. */
export interface ServerToClientEvents {
  presence: (payload: { online: number; waiting: number }) => void;
  /** Login is on and `hello` had no valid session; nothing else works until it does. */
  "auth:required": () => void;
  /** The user skipped too fast; they are queued automatically once `until` passes. */
  "queue:cooldown": (payload: { until: number }) => void;
  banned: (payload: { until: number }) => void;
  "room:matched": (payload: {
    roomId: string;
    peer: PeerInfo;
    initiator: boolean;
    iceServers: IceServer[];
    endsAt: number;
    private: boolean;
    /** The peer's queue mini-game result, if they have one to brag about. */
    brag: string | null;
  }) => void;
  "rtc:signal": (signal: RtcSignal) => void;
  "room:reveal:state": (payload: { me: boolean; peer: boolean; revealed: boolean }) => void;
  "room:timer": (payload: { endsAt: number }) => void;
  "room:extend:state": (payload: { me: boolean; peer: boolean }) => void;
  "room:connected": (payload: { peer: PeerInfo }) => void;
  "room:chat": (payload: { text: string; at: number }) => void;
  "room:ended": (payload: { reason: RoomEndReason }) => void;
  "friend:invite": (payload: { inviteId: string; from: PeerInfo }) => void;
  "friend:invite:result": (payload: { inviteId: string; accepted: boolean }) => void;
  "friend:status": (payload: { status: Record<string, FriendStatus> }) => void;
}

export const ROUND_MS = 5 * 60 * 1000;
export const EXTEND_MS = 5 * 60 * 1000;
export const EXTEND_PROMPT_MS = 30 * 1000;
/** "Tiếp" is locked for the first seconds of a room - give the person a chance. */
export const NEXT_LOCK_MS = 20 * 1000;
/** Skipping SKIP_LIMIT rooms within SKIP_WINDOW_MS earns a SKIP_COOLDOWN_MS wait. */
export const SKIP_LIMIT = 3;
export const SKIP_WINDOW_MS = 2 * 60 * 1000;
export const SKIP_COOLDOWN_MS = 20 * 1000;
export const CHAT_MAX = 200;
/** At most CHAT_RATE messages per CHAT_WINDOW_MS; extra ones are dropped. */
export const CHAT_RATE = 5;
export const CHAT_WINDOW_MS = 5 * 1000;
export const REMATCH_COOLDOWN_MS = 10 * 60 * 1000;
export const REPORTS_TO_BAN = 3;
export const BAN_MS = 24 * 60 * 60 * 1000;
export const NAME_MAX = 20;
/** Only student emails may sign in (when login is enabled). */
export const ALLOWED_EMAIL_SUFFIX = ".edu.vn";
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const TAGS = [
  "học bài",
  "tiếng Anh",
  "game",
  "nhạc",
  "phim",
  "thể thao",
  "tâm sự",
  "đêm khuya",
] as const;
