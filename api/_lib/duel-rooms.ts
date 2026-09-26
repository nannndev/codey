import { Query } from 'node-appwrite';
import { APPWRITE } from './appwrite-admin.js';

/**
 * Public duel rooms: a directory of rooms that are waiting for players. The
 * race itself stays peer to peer; this only tells people which rooms exist.
 * Hosts refresh their listing every ~20s, so a closed tab drops out on its own.
 */

/** A listing not refreshed for this long is treated as closed. */
export const ROOM_TTL_MS = 50_000;
/** Stale listings older than this are deleted when the list is read. */
const PURGE_AFTER_MS = 10 * 60_000;
const CODE_PATTERN = /^CODEY-[A-Z0-9]{6}$/;
const MODES = new Set(['snippet', 'timed']);
const STATUSES = new Set(['lobby', 'racing']);

export interface RoomListing {
  code: string;
  hostId: string;
  hostName: string;
  language: string;
  mode: string;
  detail: string;
  players: number;
  maxPlayers: number;
  status: string;
  custom: boolean;
  heartbeatAt: string;
}

type Doc = Record<string, unknown> & { $id: string };

export interface DuelDb {
  getDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<Doc>;
  createDocument(params: { databaseId: string; collectionId: string; documentId: string; data: Record<string, unknown> }): Promise<Doc>;
  updateDocument(params: { databaseId: string; collectionId: string; documentId: string; data: Record<string, unknown> }): Promise<Doc>;
  deleteDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<unknown>;
  listDocuments(params: { databaseId: string; collectionId: string; queries?: string[] }): Promise<{ documents: Doc[] }>;
}

const collection = () => ({ databaseId: APPWRITE.databaseId, collectionId: APPWRITE.collections.duelRooms });
const where = (documentId: string) => ({ ...collection(), documentId });

const isNotFound = (error: unknown) => (error as { code?: number })?.code === 404;

const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const int = (value: unknown, min: number, max: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
};

export function toListing(doc: Doc): RoomListing {
  return {
    code: String(doc.code),
    hostId: String(doc.hostId),
    hostName: String(doc.hostName),
    language: String(doc.language),
    mode: String(doc.mode),
    detail: String(doc.detail),
    players: Number(doc.players),
    maxPlayers: Number(doc.maxPlayers),
    status: String(doc.status),
    custom: Boolean(doc.custom),
    heartbeatAt: String(doc.heartbeatAt),
  };
}

/** Validates a host's listing; the host identity always comes from the session, never the body. */
export function parseListing(body: Record<string, unknown>, host: { id: string; name: string }, now = Date.now()):
  { listing: RoomListing } | { error: string } {
  const code = text(body.code, 12).toUpperCase();
  if (!CODE_PATTERN.test(code)) return { error: 'Invalid room code.' };
  const mode = text(body.mode, 16);
  if (!MODES.has(mode)) return { error: 'Invalid mode.' };
  const status = text(body.status, 16) || 'lobby';
  if (!STATUSES.has(status)) return { error: 'Invalid status.' };
  const maxPlayers = int(body.maxPlayers, 2, 6);
  return {
    listing: {
      code,
      hostId: host.id,
      hostName: text(host.name, 64) || 'Typist',
      language: text(body.language, 64) || 'Mixed',
      mode,
      detail: text(body.detail, 32),
      players: int(body.players, 1, maxPlayers),
      maxPlayers,
      status,
      custom: body.custom === true,
      heartbeatAt: new Date(now).toISOString(),
    },
  };
}

/** Open rooms, fullest first so new players fill rooms instead of spreading out. */
export async function listOpenRooms(db: DuelDb, now = Date.now()): Promise<RoomListing[]> {
  const cutoff = new Date(now - ROOM_TTL_MS).toISOString();
  const { documents } = await db.listDocuments({
    ...collection(),
    queries: [Query.greaterThan('heartbeatAt', cutoff), Query.orderDesc('heartbeatAt'), Query.limit(50)],
  });
  void purgeStale(db, now).catch((error) => console.warn('Duel room purge failed:', error));
  return documents
    .map(toListing)
    .sort((a, b) => Number(a.status === 'racing') - Number(b.status === 'racing') || (b.players / b.maxPlayers) - (a.players / a.maxPlayers));
}

async function purgeStale(db: DuelDb, now: number) {
  const { documents } = await db.listDocuments({
    ...collection(),
    queries: [Query.lessThan('heartbeatAt', new Date(now - PURGE_AFTER_MS).toISOString()), Query.limit(10)],
  });
  await Promise.all(documents.map((doc) => db.deleteDocument(where(doc.$id))));
}

/** Creates or refreshes a listing. One live room per host; their older listings are removed. */
export async function publishRoom(db: DuelDb, listing: RoomListing, now = Date.now()): Promise<{ ok: true } | { error: string; status: number }> {
  let existing: Doc | null = null;
  try {
    existing = await db.getDocument(where(listing.code));
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (existing) {
    const stale = now - Date.parse(String(existing.heartbeatAt)) > PURGE_AFTER_MS;
    if (existing.hostId !== listing.hostId && !stale) return { error: 'That room belongs to someone else.', status: 403 };
    await db.updateDocument({ ...where(listing.code), data: { ...listing } });
  } else {
    await db.createDocument({ ...where(listing.code), data: { ...listing } });
    const { documents } = await db.listDocuments({
      ...collection(),
      queries: [Query.equal('hostId', listing.hostId), Query.limit(10)],
    });
    await Promise.all(documents.filter((doc) => doc.$id !== listing.code).map((doc) => db.deleteDocument(where(doc.$id))));
  }
  return { ok: true };
}

export async function unpublishRoom(db: DuelDb, hostId: string, code: string): Promise<{ ok: true } | { error: string; status: number }> {
  const id = text(code, 12).toUpperCase();
  if (!CODE_PATTERN.test(id)) return { error: 'Invalid room code.', status: 400 };
  try {
    const existing = await db.getDocument(where(id));
    if (existing.hostId !== hostId) return { error: 'That room belongs to someone else.', status: 403 };
    await db.deleteDocument(where(id));
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  return { ok: true };
}
