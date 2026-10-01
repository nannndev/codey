import { useState } from "react";
import { BadgeCheck, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { badgeImageUrl, badgeSnippet, type BadgeStyle, type BadgeTheme } from "@/lib/share-links";
import { cn } from "@/lib/utils";

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="inline-flex rounded-lg border bg-background p-0.5" role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer", value === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** "Put this on your GitHub profile": a live badge, its preview and the snippet to paste. */
export function ReadmeBadge({ userId }: { userId: string }) {
  const [style, setStyle] = useState<BadgeStyle>("card");
  const [theme, setTheme] = useState<BadgeTheme>("auto");
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;
  const snippet = badgeSnippet(origin, userId, style, theme);
  const previews: ("dark" | "light")[] = theme === "auto" ? ["dark", "light"] : [theme];

  return (
    <section className="border-t px-4 py-4 sm:px-5" aria-labelledby="readme-badge-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="readme-badge-title" className="flex items-center gap-2 text-sm font-bold"><BadgeCheck className="size-4 text-amber-500" /> Badge for your GitHub README</h3>
          <p className="text-[11px] text-muted-foreground">It updates on its own as you practice, and links back to your profile.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented label="Badge style" value={style} onChange={setStyle} options={[["card", "Card"], ["flat", "Flat"]]} />
          <Segmented label="Badge theme" value={theme} onChange={setTheme} options={[["auto", "Auto"], ["dark", "Dark"], ["light", "Light"]]} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/35 p-3">
        {previews.map((tone) => (
          <div key={tone} className={cn("rounded-lg p-2", tone === "dark" ? "bg-[#0d1117]" : "bg-white")}>
            <img src={badgeImageUrl(origin, userId, style, tone)} alt={`Codey badge, ${tone} theme`} className={style === "card" ? "h-[100px] w-auto" : "h-5 w-auto"} loading="lazy" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{snippet}</pre>
        <Button
          type="button"
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(snippet).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          })}
        >
          {copied ? <Check data-icon="inline-start" className="text-green-500" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied!" : theme === "auto" ? "Copy HTML" : "Copy Markdown"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Paste it into the README of the repo named after your username (github.com/you/you) to show it on your profile.
      </p>
    </section>
  );
}
