import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Every page except the typing screen loads on demand, so the first visit
 * only downloads what the home page needs. `preloadRoutes` warms the rest
 * once the browser is idle, so moving between pages stays instant.
 */
const loaders = {
  Settings: () => import("./Settings"),
  History: () => import("./History"),
  Leaderboard: () => import("./Leaderboard"),
  Profile: () => import("./Profile"),
  Donate: () => import("./Donate"),
  Contributors: () => import("./Contributors"),
  Duel: () => import("./Duel"),
  Arcade: () => import("./Arcade"),
  Daily: () => import("./Daily"),
  KeyboardAnalytics: () => import("./KeyboardAnalytics"),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>;

type RouteName = keyof typeof loaders;

export const Pages = Object.fromEntries(
  Object.entries(loaders).map(([name, load]) => [name, lazy(load)])
) as unknown as Record<RouteName, LazyExoticComponent<ComponentType>>;

/** Pages reachable from the header, warmed first. */
const PRELOAD_ORDER: RouteName[] = ["Duel", "Daily", "Leaderboard", "KeyboardAnalytics", "History", "Profile", "Arcade", "Settings"];

export function preloadRoutes() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || connection?.effectiveType === "2g") return;
  const idle = (callback: () => void) =>
    "requestIdleCallback" in window ? window.requestIdleCallback(callback, { timeout: 4000 }) : setTimeout(callback, 1500);
  // Pieces of the home page that only appear later.
  const extras = [() => import("@/components/ResultsScreen"), () => import("@/components/SoundPackModal")];
  let index = 0;
  const next = () => {
    const load = index < extras.length ? extras[index] : loaders[PRELOAD_ORDER[index - extras.length]];
    index += 1;
    if (!load) return;
    void load().catch(() => undefined).finally(() => idle(next));
  };
  idle(next);
}
