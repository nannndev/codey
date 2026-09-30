import { apiError, getJwtToken, rankedApiUrl } from "./ranked";

/**
 * Web Push from Codey's server: the streak reminder (sent every evening at
 * 19:00 WIB when your streak would break tonight) and league nudges, even
 * with every Codey tab closed. The choice is kept per device.
 */

export const PUSH_KEY = "codey_push";
export const PUSH_EVENT = "codey:push-changed";

export interface PushPrefs {
  enabled: boolean;
  streak: boolean;
  league: boolean;
}

export const DEFAULT_PUSH: PushPrefs = { enabled: false, streak: true, league: true };

export function readPush(): PushPrefs {
  try {
    return { ...DEFAULT_PUSH, ...(JSON.parse(localStorage.getItem(PUSH_KEY) ?? "null") as Partial<PushPrefs> | null) };
  } catch {
    return DEFAULT_PUSH;
  }
}

function writePush(prefs: PushPrefs) {
  try {
    localStorage.setItem(PUSH_KEY, JSON.stringify(prefs));
  } catch {
    // This tab only.
  }
  window.dispatchEvent(new CustomEvent(PUSH_EVENT));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

let config: Promise<{ enabled: boolean; publicKey: string | null }> | null = null;
/** Whether this server sends push at all (VAPID keys set in Vercel). */
export function pushConfig() {
  config ??= fetch(rankedApiUrl("/api/push/config"))
    .then((response) => (response.ok ? response.json() : { enabled: false, publicKey: null }))
    .catch(() => ({ enabled: false, publicKey: null }));
  return config;
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function post(path: string, body: unknown) {
  const jwt = await getJwtToken();
  if (!jwt) throw new Error("Sign in with GitHub to get notifications.");
  const response = await fetch(rankedApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await apiError(response, "Notifications could not be updated.");
  return response.json();
}

/** Asks for permission, subscribes this device and tells the server what to send. */
export async function enablePush(choice: Pick<PushPrefs, "streak" | "league">): Promise<PushPrefs> {
  const { enabled, publicKey } = await pushConfig();
  if (!enabled || !publicKey) throw new Error("Push notifications are not set up on this server yet.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for Codey in your browser settings.");
  const registration = await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await post("/api/push/subscribe", { ...subscription.toJSON(), ...choice, tzOffset: -new Date().getTimezoneOffset() });
  const prefs = { enabled: true, ...choice };
  writePush(prefs);
  return prefs;
}

export async function disablePush(): Promise<PushPrefs> {
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await post("/api/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  }
  const prefs = { ...readPush(), enabled: false };
  writePush(prefs);
  return prefs;
}
