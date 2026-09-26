import { useEffect, useState } from "react";
import { Check, Copy, Download, ImageDown, Link2, LoaderCircle, Share2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createResultCard, SHARE_THEMES, type ShareCardOptions, type ShareCardTheme } from "@/lib/share-result";
import { usePreferences } from "@/components/PreferencesProvider";
import { getColorway } from "@/lib/keycaps";
import { useAuth } from "@/components/AuthProvider";
import { shareableRunId } from "@/lib/cloud";
import { platformShareUrl, runCardUrl, runShareUrl, SHARE_PLATFORMS, shareCaption, shareText, type SharePlatform } from "@/lib/share-links";

interface SharePreviewDialogProps {
  options: ShareCardOptions | null;
  onClose: () => void;
}

type CardStyle = "card" | "detailed";

export function SharePreviewDialog({ options, onClose }: SharePreviewDialogProps) {
  const [theme, setTheme] = useState<ShareCardTheme>("dark");
  const [style, setStyle] = useState<CardStyle>("card");
  const [cardFailed, setCardFailed] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "shared" | "error">("loading");
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  // undefined while the link is being prepared; null when the run has no public page.
  const [runId, setRunId] = useState<string | null | undefined>(undefined);
  const { preferences } = usePreferences();
  const { user } = useAuth();
  const userId = user?.$id ?? null;
  const { keycapTheme, keycapOverrides } = preferences;
  const shareUrl = runId === undefined ? null : runShareUrl(window.location.origin, runId);
  // The link's own preview card when the run has one; the detailed card otherwise.
  const cardStyle: CardStyle | null = runId === undefined ? null : runId && !cardFailed ? style : "detailed";

  // The public link: the run's own page when it is in the cloud, otherwise the site.
  useEffect(() => {
    if (!options) return;
    let active = true;
    setRunId(undefined);
    setCardFailed(false);
    void shareableRunId(userId, options.result).then((id) => {
      if (active) setRunId(id);
    });
    return () => { active = false; };
  }, [options, userId]);

  useEffect(() => {
    if (!options || !cardStyle) return;
    let active = true;
    setStatus("loading");
    const render = cardStyle === "card" && runId
      ? fetch(runCardUrl(window.location.origin, runId)).then(async (response) => {
          const type = response.headers.get("content-type") ?? "";
          if (!response.ok || !type.startsWith("image/")) throw new Error(`Card unavailable (${response.status})`);
          return response.blob();
        })
      : createResultCard({ ...options, theme, keycaps: { colorway: getColorway(keycapTheme), overrides: keycapOverrides } });
    void render.then((nextBlob) => {
      if (!active) return;
      setBlob(nextBlob);
      setPreviewUrl(URL.createObjectURL(nextBlob));
      setStatus("ready");
    }).catch(() => {
      if (!active) return;
      // No server card (offline, local dev): fall back to drawing one here.
      if (cardStyle === "card") setCardFailed(true);
      else setStatus("error");
    });
    return () => {
      active = false;
      setBlob(null);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, [options, cardStyle, runId, theme, keycapTheme, keycapOverrides]);

  useEffect(() => {
    if (!options) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [options, onClose]);

  if (!options) return null;
  const filename = `codey-${Math.round(options.result.wpm)}wpm.png`;
  const canNativeShare = typeof navigator.share === "function";

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyImage = async () => {
    if (!blob || !navigator.clipboard?.write) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch {
      download();
    }
  };

  const text = shareText(options.result, options.rank);
  const flash = (set: (value: boolean) => void) => { set(true); setTimeout(() => set(false), 2000); };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(shareCaption(text, shareUrl ?? window.location.origin));
    flash(setCopiedCaption);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    flash(setCopiedLink);
  };

  const openPlatform = (platform: SharePlatform) => {
    if (!shareUrl) return;
    window.open(platformShareUrl(platform, text, shareUrl), "_blank", "noopener,noreferrer,width=640,height=720");
  };

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], filename, { type: "image/png" });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      download();
      return;
    }
    try {
      await navigator.share({ files: [file], title: "Codey", text: shareCaption(text, shareUrl ?? window.location.origin) });
      setStatus("shared");
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "AbortError") setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Share image preview" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border bg-background shadow-2xl animate-scale-in">
        <div className="flex flex-wrap items-center justify-between border-b px-4 py-3 sm:px-5 gap-2">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-purple-500" /> Share Result Card
            </h2>
            <p className="text-[11px] text-muted-foreground">{cardStyle === "card" ? "The same card your link shows on Threads, X and WhatsApp." : "Pick a theme and export the image for social media."}</p>
          </div>
          
          <div className="order-last flex w-full flex-wrap items-center gap-2 empty:hidden">
            {runId && !cardFailed && (
              <div className="flex items-center gap-1 rounded-lg border bg-muted/60 p-1" role="group" aria-label="Card style">
                {([["card", "Codey card"], ["detailed", "Detailed"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStyle(key)}
                    aria-pressed={style === key}
                    className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all ${
                      style === key ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {cardStyle === "detailed" && (
              <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted/60 p-1" role="group" aria-label="Card theme">
                {(Object.keys(SHARE_THEMES) as ShareCardTheme[]).map((tKey) => (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => setTheme(tKey)}
                    aria-pressed={theme === tKey}
                    className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all ${
                      theme === tKey
                        ? "bg-foreground text-background shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {SHARE_THEMES[tKey].name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close preview">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-64 place-items-center bg-muted/35 p-3 sm:p-6">
          {status === "loading" || !cardStyle ? (
            <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Generated Codey statistics card" className="max-h-[60vh] w-full rounded-xl border object-contain shadow-2xl transition-all" />
          ) : (
            <p className="text-sm text-muted-foreground">Unable to generate preview.</p>
          )}
        </div>

        <div className="border-t px-4 pt-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Post to</p>
            <button type="button" onClick={() => void copyLink()} disabled={!shareUrl} className="flex min-w-0 max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60" aria-label="Copy link">
              {copiedLink ? <Check className="size-3 shrink-0 text-green-500" /> : <Link2 className="size-3 shrink-0" />}
              <span className="truncate">{copiedLink ? "Link copied" : shareUrl ? shareUrl.replace(/^https?:\/\//, "") : "Preparing link…"}</span>
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {SHARE_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => openPlatform(platform.id)}
                disabled={!shareUrl}
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
            {runId
              ? "The link shows your score card as its preview. For Instagram stories, download the image and post it there."
              : "Sign in to get a link with your own score card. For Instagram, download the image and post it there."}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={copyCaption} className="text-xs text-muted-foreground hover:text-foreground">
            {copiedCaption ? <Check data-icon="inline-start" className="size-3.5 text-green-500" /> : <Copy data-icon="inline-start" className="size-3.5" />}
            {copiedCaption ? "Caption Copied!" : "Copy Post Caption"}
          </Button>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&>*:last-child]:col-span-2">
            <Button type="button" variant="outline" onClick={copyImage} disabled={!blob}>
              {copiedImage ? <Check data-icon="inline-start" className="text-green-500" /> : <Copy data-icon="inline-start" />}
              {copiedImage ? "Copied to Clipboard!" : "Copy Image"}
            </Button>
            <Button type="button" variant="outline" onClick={download} disabled={!blob}>
              <Download data-icon="inline-start" /> Download PNG
            </Button>
            <Button type="button" onClick={() => void share()} disabled={!blob}>
              {status === "shared" ? <Check data-icon="inline-start" /> : <Share2 data-icon="inline-start" />}
              {status === "shared" ? "Shared" : canNativeShare ? "Share Image" : "Download Image"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
