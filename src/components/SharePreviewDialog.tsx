import { useEffect, useState } from "react";
import { Check, Copy, Download, LoaderCircle, Share2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createResultCard, SHARE_THEMES, type ShareCardOptions, type ShareCardTheme } from "@/lib/share-result";
import { usePreferences } from "@/components/PreferencesProvider";
import { getColorway } from "@/lib/keycaps";

interface SharePreviewDialogProps {
  options: ShareCardOptions | null;
  onClose: () => void;
}

export function SharePreviewDialog({ options, onClose }: SharePreviewDialogProps) {
  const [theme, setTheme] = useState<ShareCardTheme>("dark");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "shared" | "error">("loading");
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const { preferences } = usePreferences();
  const { keycapTheme, keycapOverrides } = preferences;

  useEffect(() => {
    if (!options) return;
    let active = true;
    setStatus("loading");
    const keycaps = { colorway: getColorway(keycapTheme), overrides: keycapOverrides };
    void createResultCard({ ...options, theme, keycaps }).then((nextBlob) => {
      if (!active) return;
      setBlob(nextBlob);
      setPreviewUrl(URL.createObjectURL(nextBlob));
      setStatus("ready");
    }).catch(() => active && setStatus("error"));
    return () => {
      active = false;
      setBlob(null);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, [options, theme, keycapTheme, keycapOverrides]);

  useEffect(() => {
    if (!options) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [options, onClose]);

  if (!options) return null;
  const filename = `codetype-${Math.round(options.result.wpm)}wpm.png`;
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

  const copyCaption = async () => {
    const rankBadge = options.rank === 1 ? "👑 Ranked #1 Gold" : options.rank === 2 ? "🥈 Ranked #2 Silver" : options.rank === 3 ? "🥉 Ranked #3 Bronze" : `⚡ Ranked #${options.rank}`;
    const text = options.rank
      ? `🏆 ${rankBadge} on the Codey Leaderboard!\nScore: ${options.result.wpm.toFixed(1)} WPM (${options.result.accuracy.toFixed(1)}% acc) in ${options.result.language}\nSee the leaderboard: https://codey.dev/leaderboard #Codey #typingtest`
      : `⚡ Just scored ${options.result.wpm.toFixed(1)} WPM with ${options.result.accuracy.toFixed(1)}% accuracy in ${options.result.language} on Codey!\nPractice real code typing: https://codey.dev #Codey #typingtest`;
    await navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], filename, { type: "image/png" });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      download();
      return;
    }
    try {
      await navigator.share({ files: [file], title: "Codey Stats", text: `${options.result.wpm.toFixed(1)} WPM on ${options.result.language}` });
      setStatus("shared");
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "AbortError") setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Share image preview" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border bg-background shadow-2xl animate-scale-in">
        <div className="flex flex-wrap items-center justify-between border-b px-4 py-3 sm:px-5 gap-2">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-purple-500" /> Share Result Card
            </h2>
            <p className="text-[11px] text-muted-foreground">Customize card theme and export image for social media.</p>
          </div>
          
          {/* Theme Selector */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/60 p-1">
            {(Object.keys(SHARE_THEMES) as ShareCardTheme[]).map((tKey) => (
              <button
                key={tKey}
                type="button"
                onClick={() => setTheme(tKey)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all ${
                  theme === tKey
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {SHARE_THEMES[tKey].name}
              </button>
            ))}
          </div>

          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close preview">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-64 place-items-center bg-muted/35 p-3 sm:p-6">
          {status === "loading" ? (
            <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Generated Codey statistics card" className="max-h-[60vh] w-full rounded-xl border object-contain shadow-2xl transition-all" />
          ) : (
            <p className="text-sm text-muted-foreground">Unable to generate preview.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={copyCaption} className="text-xs text-muted-foreground hover:text-foreground">
            {copiedCaption ? <Check data-icon="inline-start" className="size-3.5 text-green-500" /> : <Copy data-icon="inline-start" className="size-3.5" />}
            {copiedCaption ? "Caption Copied!" : "Copy Post Caption"}
          </Button>

          <div className="flex flex-wrap gap-2 sm:justify-end">
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
