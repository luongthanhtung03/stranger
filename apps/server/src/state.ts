import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, GameScore, ServerToClientEvents, Tag } from "@stranger/shared";

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface User {
  socket: Sock;
  deviceId: string;
  name: string;
  tags: Tag[];
  blocked: Set<string>;
  roomId: string | null;
  queuedAt: number | null;
  /** Got skipped -> goes to the front of the queue next time. */
  priority: boolean;
  cooldownTimer: NodeJS.Timeout | null;
  game: GameScore | null;
}

export interface Room {
  id: string;
  members: [string, string]; // socket ids
  private: boolean;
  endsAt: number; // 0 = no timer
  reveal: Set<string>;
  extend: Set<string>;
  connect: Set<string>;
  endTimer: NodeJS.Timeout | null;
  cardTimer: NodeJS.Timeout | null;
}

export const users = new Map<string, User>(); // socket id -> user
export const socketByDevice = new Map<string, string>(); // device id -> socket id
export const rooms = new Map<string, Room>();

export function userByDevice(deviceId: string): User | undefined {
  const sid = socketByDevice.get(deviceId);
  return sid ? users.get(sid) : undefined;
}

export function peerOf(room: Room, socketId: string): string {
  return room.members[0] === socketId ? room.members[1] : room.members[0];
}

export function publicInfo(u: User) {
  return { deviceId: u.deviceId, name: u.name, tags: u.tags };
}
