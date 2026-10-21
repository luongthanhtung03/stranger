import type { PeerInfo } from "@stranger/shared";

// Beta identity: no accounts. A random deviceId in localStorage is the user.

const KEYS = {
  device: "stranger.deviceId",
  name: "stranger.name",
  tags: "stranger.tags",
  friends: "stranger.friends",
  school: "stranger.school",
  blocked: "stranger.blocked",
  dataSaver: "stranger.dataSaver",
  session: "stranger.session",
} as const;

export interface Friend extends PeerInfo {
  metAt: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. — the app still works for this session */
  }
}

export function getDeviceId(): string {
  let id = read<string | null>(KEYS.device, null);
  if (!id) {
    id = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    write(KEYS.device, id);
  }
  return id;
}

export const getName = () => read<string>(KEYS.name, "");
export const setName = (name: string) => write(KEYS.name, name);
export const getTags = () => read<string[]>(KEYS.tags, []);
export const setTags = (tags: string[]) => write(KEYS.tags, tags);
export const getSchool = () => read<string | null>(KEYS.school, null);
export const setSchool = (id: string | null) => write(KEYS.school, id);
export const getDataSaver = () => read<boolean>(KEYS.dataSaver, false);
export const setDataSaver = (v: boolean) => write(KEYS.dataSaver, v);

/** Signed-in account (only used when login is enabled). */
export interface Account {
  session: string;
  email: string;
}
export const getAccount = () => read<Account | null>(KEYS.session, null);
export const setAccount = (a: Account | null) => write(KEYS.session, a);

export const getFriends = () => read<Friend[]>(KEYS.friends, []);
export function addFriend(peer: PeerInfo) {
  const list = getFriends().filter((f) => f.deviceId !== peer.deviceId);
  list.unshift({ ...peer, metAt: Date.now() });
  write(KEYS.friends, list.slice(0, 200));
}
export function removeFriend(deviceId: string) {
  write(KEYS.friends, getFriends().filter((f) => f.deviceId !== deviceId));
}

export const getBlocked = () => read<string[]>(KEYS.blocked, []);
export function addBlocked(deviceId: string) {
  const set = new Set(getBlocked());
  set.add(deviceId);
  write(KEYS.blocked, [...set].slice(-500));
  removeFriend(deviceId);
}
