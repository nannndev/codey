import { Client, Users } from 'node-appwrite';
import { APPWRITE } from './appwrite-admin.js';
import { FLAME_TIERS, tierFor, type FlameTier } from '../../src/utils/flame-tiers.js';
import { kapDataUri, sanitizeLook, type KapLook } from '../../src/utils/kap-art.js';

/**
 * The player's Kap for share cards: the look they chose in the Wardrobe,
 * read from their account prefs (the synced `kapLook` slice), limited to
 * items their synced achievements unlock.
 */

type Prefs = Record<string, unknown>;

export function lookFromPrefs(prefs: Prefs): KapLook {
  const slices = ((prefs.sync as { slices?: Record<string, { value?: unknown }> } | undefined)?.slices ?? {});
  const unlockedAt = ((prefs.achievements as { unlockedAt?: Record<string, unknown> } | undefined)?.unlockedAt ?? {});
  return sanitizeLook(slices.kapLook?.value, new Set(Object.keys(unlockedAt)));
}

async function readPrefs(userId: string): Promise<Prefs> {
  if (!APPWRITE.apiKey || !APPWRITE.projectId) return {};
  const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.projectId).setKey(APPWRITE.apiKey);
  return (await new Users(client).getPrefs({ userId })) as Prefs;
}

/** The player's Kap: their flame by streak and their Wardrobe look (plain when it cannot be read). */
export async function playerLook(userId: string, streakDays = 7, read: (id: string) => Promise<Prefs> = readPrefs): Promise<{ tier: FlameTier; look: KapLook }> {
  let look: KapLook = {};
  try {
    if (userId) look = lookFromPrefs(await read(userId));
  } catch {
    // The card still draws, with Kap in his usual amber.
  }
  return { tier: tierFor(streakDays) ?? FLAME_TIERS[1], look };
}

/** A data URI of the player's Kap. */
export async function playerKap(userId: string, streakDays = 7, width = 200, read: (id: string) => Promise<Prefs> = readPrefs): Promise<string> {
  const { tier, look } = await playerLook(userId, streakDays, read);
  return kapDataUri(tier, look, width);
}
