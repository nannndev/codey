import { useEffect, useState, type ComponentType } from "react";
import { Check, Copy, Download, LoaderCircle, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharePostPanel } from "@/components/SharePostPanel";
import { shareCaption } from "@/lib/share-links";
import { copyBlob, downloadBlob, shareBlob } from "@/lib/share-image";

/** A share dialog for any rendered card: preview, post-to buttons, copy, download, system share. */
export interface ImageShare {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  /** Draws (or fetches) the card. */
  load: () => Promise<Blob>;
  text: string;
  /** The link to post; null while it is prepared. */
  url: string | null;
  hint: string;
  filename: string;
}

export function ImageShareDialog({ share, onClose }: { share: ImageShare | null; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "shared">("loading");
  const [copied, setCopied] = useState<"image" | "caption" | null>(null);

  useEffect(() => {
    if (!share) return;
    let active = true;
    setStatus("loading");
    void share.load().then((next) => {
      if (!active) return;
      setBlob(next);
      setPreview(URL.createObjectURL(next));
      setStatus("ready");
    }).catch(() => active && setStatus("error"));
    return () => {
      active = false;
      setBlob(null);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, [share]);

  useEffect(() => {
    if (!share) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [share, onClose]);

  if (!share) return null;
  const Icon = share.icon;
  const caption = shareCaption(share.text, share.url ?? window.location.origin);
  const flash = (what: "image" | "caption") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={share.title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => event.stopPropagation()}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border bg-background shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold"><Icon className="size-4 text-amber-500" /> {share.title}</h2>
            <p className="text-[11px] text-muted-foreground">{share.subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid min-h-64 place-items-center bg-muted/35 p-3 sm:p-6">
          {status === "loading" ? (
            <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
          ) : preview ? (
            <img src={preview} alt={share.title} className="max-h-[60vh] w-full rounded-xl border object-contain shadow-2xl" />
          ) : (
            <p className="text-sm text-muted-foreground">Unable to draw the card.</p>
          )}
        </div>
        <SharePostPanel text={share.text} url={share.url} hint={share.hint} />
        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(caption).then(() => flash("caption"))} className="text-xs text-muted-foreground hover:text-foreground">
            {copied === "caption" ? <Check data-icon="inline-start" className="size-3.5 text-green-500" /> : <Copy data-icon="inline-start" className="size-3.5" />}
            {copied === "caption" ? "Caption Copied!" : "Copy Post Caption"}
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&>*:last-child]:col-span-2">
            <Button type="button" variant="outline" disabled={!blob} onClick={() => blob && void copyBlob(blob, share.filename).then((ok) => ok && flash("image"))}>
              {copied === "image" ? <Check data-icon="inline-start" className="text-green-500" /> : <Copy data-icon="inline-start" />}
              {copied === "image" ? "Copied to Clipboard!" : "Copy Image"}
            </Button>
            <Button type="button" variant="outline" disabled={!blob} onClick={() => blob && downloadBlob(blob, share.filename)}>
              <Download data-icon="inline-start" /> Download PNG
            </Button>
            <Button type="button" disabled={!blob} onClick={() => blob && void shareBlob(blob, share.filename, caption).then((result) => result === "shared" && setStatus("shared")).catch(() => undefined)}>
              {status === "shared" ? <Check data-icon="inline-start" /> : <Share2 data-icon="inline-start" />}
              {status === "shared" ? "Shared" : "Share Image"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
