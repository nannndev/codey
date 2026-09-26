import { useState } from "react";
import { Check, ImageDown, Link2 } from "lucide-react";
import { platformShareUrl, SHARE_PLATFORMS, type SharePlatform } from "@/lib/share-links";

interface SharePostPanelProps {
  /** The post text, without the link. */
  text: string;
  /** The link to share; null while it is being prepared. */
  url: string | null;
  hint: string;
}

/** "Post to" row: one-tap intents for each platform plus a copyable link. */
export function SharePostPanel({ text, url, hint }: SharePostPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openPlatform = (platform: SharePlatform) => {
    if (!url) return;
    window.open(platformShareUrl(platform, text, url), "_blank", "noopener,noreferrer,width=640,height=720");
  };

  return (
    <div className="border-t px-4 pt-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Post to</p>
        <button type="button" onClick={() => void copyLink()} disabled={!url} className="flex min-w-0 max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60" aria-label="Copy link">
          {copied ? <Check className="size-3 shrink-0 text-green-500" /> : <Link2 className="size-3 shrink-0" />}
          <span className="truncate">{copied ? "Link copied" : url ? url.replace(/^https?:\/\//, "") : "Preparing link…"}</span>
        </button>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {SHARE_PLATFORMS.map((platform) => (
          <button
            key={platform.id}
            type="button"
            onClick={() => openPlatform(platform.id)}
            disabled={!url}
            className="group flex flex-col items-center gap-1.5 rounded-xl border bg-card px-1 py-2.5 text-[11px] font-medium transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="grid size-8 place-items-center rounded-full text-sm font-bold text-white" style={{ background: platform.color }} aria-hidden>
              {platform.name === "X" ? "𝕏" : platform.name === "Threads" ? "@" : platform.name.slice(0, 1)}
            </span>
            {platform.name}
          </button>
        ))}
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <ImageDown className="mt-px size-3.5 shrink-0" />
        {hint}
      </p>
    </div>
  );
}
