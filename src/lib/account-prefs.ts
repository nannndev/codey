import { account } from "./appwrite";

type Prefs = Record<string, unknown>;

let queue: Promise<unknown> = Promise.resolve();

/**
 * Account prefs are one JSON object replaced on every write, so concurrent
 * writers (daily goals, achievements, settings sync) would overwrite each
 * other. Every write goes through this queue and re-reads the latest prefs.
 */
export function updateAccountPrefs(mutate: (prefs: Prefs) => Prefs | null): Promise<Prefs | null> {
  const run = queue.then(async () => {
    if (!account) return null;
    const current = (await account.get()).prefs as Prefs;
    const next = mutate({ ...current });
    if (!next || JSON.stringify(next) === JSON.stringify(current)) return current;
    const saved = await account.updatePrefs({ prefs: next });
    return saved.prefs as Prefs;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function readAccountPrefs(): Promise<Prefs | null> {
  if (!account) return null;
  await queue;
  return (await account.get()).prefs as Prefs;
}
