import { apiError, getJwtToken, rankedApiUrl } from "./ranked";

/** Client for /api/duel/rooms: the directory of public duel rooms. */

export interface PublicRoom {
  code: string;
  hostId: string;
  hostName: string;
  language: string;
  mode: "snippet" | "timed";
  detail: string;
  players: number;
  maxPlayers: number;
  status: "lobby" | "racing";
  custom: boolean;
  heartbeatAt: string;
}

export interface RoomListingInput {
  code: string;
  language: string;
  mode: "snippet" | "timed";
  detail: string;
  players: number;
  maxPlayers: number;
  status: "lobby" | "racing";
  custom: boolean;
}

export async function listPublicRooms(): Promise<PublicRoom[]> {
  const response = await fetch(rankedApiUrl("/api/duel/rooms"), { cache: "no-store" });
  if (!response.ok) throw await apiError(response, "Open rooms could not be loaded.");
  return ((await response.json()) as { rooms: PublicRoom[] }).rooms;
}

async function authed(method: "POST" | "DELETE", path: string, body?: unknown, keepalive = false) {
  const jwt = await getJwtToken();
  if (!jwt) throw new Error("Sign in with GitHub to host a public room.");
  const response = await fetch(rankedApiUrl(path), {
    method,
    keepalive,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await apiError(response, "The room listing could not be updated.");
}

export function publishRoom(listing: RoomListingInput) {
  return authed("POST", "/api/duel/rooms", listing);
}

export function unpublishRoom(code: string, { keepalive = false } = {}) {
  return authed("DELETE", `/api/duel/rooms?code=${encodeURIComponent(code)}`, undefined, keepalive);
}
