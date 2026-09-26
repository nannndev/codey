import type { RunResult } from "@/types";

/**
 * Captions and "share to" links. Platforms only take text and a URL from the
 * web; the picture comes from the link's Open Graph card (/r/<runId>), which
 * the server renders from the stored run.
 */

export type SharePlatform = "threads" | "x" | "facebook" | "linkedin" | "whatsapp" | "telegram" | "reddit" | "bluesky";

export const SHARE_PLATFORMS: { id: SharePlatform; name: string; color: string }[] = [
  { id: "threads", name: "Threads", color: "#000000" },
  { id: "x", name: "X", color: "#000000" },
  { id: "facebook", name: "Facebook", color: "#1877f2" },
  { id: "linkedin", name: "LinkedIn", color: "#0a66c2" },
  { id: "whatsapp", name: "WhatsApp", color: "#25d366" },
  { id: "telegram", name: "Telegram", color: "#26a5e4" },
  { id: "reddit", name: "Reddit", color: "#ff4500" },
  { id: "bluesky", name: "Bluesky", color: "#1185fe" },
];

export function runShareUrl(origin: string, runId: string | null) {
  return runId ? `${origin}/r/${encodeURIComponent(runId)}` : origin;
}

function rankLine(rank: number) {
  if (rank === 1) return "#1 (Gold)";
  if (rank === 2) return "#2 (Silver)";
  if (rank === 3) return "#3 (Bronze)";
  return `#${rank}`;
}

const where = (language: string) => (language.toLowerCase() === "all" ? "across languages" : `in ${language}`);

/** The post text without the link, so platforms that take a separate URL do not show it twice. */
export function shareText(result: Pick<RunResult, "wpm" | "accuracy" | "language">, rank?: number) {
  // Plain text: some apps (Threads on the web) garble emoji passed through intent links.
  const score = `${result.wpm.toFixed(1)} WPM with ${result.accuracy.toFixed(1)}% accuracy ${where(result.language)}`;
  return rank
    ? `Ranked ${rankLine(rank)} on the Codey leaderboard: ${score}.`
    : `Just typed ${score} on Codey. Real code, real speed.`;
}

export function shareCaption(text: string, url: string) {
  return `${text}\n${url}\n#Codey #typingtest`;
}

export function platformShareUrl(platform: SharePlatform, text: string, url: string) {
  const q = encodeURIComponent;
  const withUrl = `${text}\n${url}`;
  switch (platform) {
    case "threads": return `https://www.threads.net/intent/post?text=${q(withUrl)}`;
    case "x": return `https://x.com/intent/post?text=${q(text)}&url=${q(url)}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${q(url)}`;
    case "linkedin": return `https://www.linkedin.com/sharing/share-offsite/?url=${q(url)}`;
    case "whatsapp": return `https://wa.me/?text=${q(withUrl)}`;
    case "telegram": return `https://t.me/share/url?url=${q(url)}&text=${q(text)}`;
    case "reddit": return `https://www.reddit.com/submit?url=${q(url)}&title=${q(text)}`;
    case "bluesky": return `https://bsky.app/intent/compose?text=${q(withUrl)}`;
  }
}
