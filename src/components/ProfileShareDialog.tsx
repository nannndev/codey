import { useEffect, useState } from "react";
import { Check, Copy, Download, LoaderCircle, Share2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharePostPanel } from "@/components/SharePostPanel";
import { profileCardUrl, profileShareText, profileShareUrl, shareCaption } from "@/lib/share-links";
import { copyBlob, downloadBlob, fetchCardImage, shareBlob } from "@/lib/share-image";

export interface ProfileShareTarget {
  userId: string;
  name: string;
  username?: string | null;
  bestWpm: number;
  runs: number;
  own: boolean;
}

interface ProfileShareDialogProps {
  target: ProfileShareTarget | null;
  onClose: () => void;
}

/** Shares a player's public profile link; the preview is the card the link shows. */
export function ProfileShareDialog({ target, onClose }: ProfileShareDialogProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "shared">("loading");
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  useEffect(() => {
    if (!target) return;
    let active = true;
    setStatus("loading");
    void fetchCardImage(profileCardUrl(window.location.origin, target.userId)).then((next) => {
      if (!active) return;
      setBlob(next);
      setPreviewUrl(URL.createObjectURL(next));
      setStatus("ready");
    }).catch(() => active && setStatus("unavailable"));
    return () => {
      active = false;
      setBlob(null);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [target, onClose]);

  if (!target) return null;
  const url = profileShareUrl(window.location.origin, target.userId);
  const text = profileShareText(target, target.own);
  const caption = shareCaption(text, url);
  const filename = `codey-${(target.username || target.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  const copyImage = async () => {
    if (blob && await copyBlob(blob, filename)) {
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    }
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const share = async () => {
    if (!blob) return;
    try {
      if (await shareBlob(blob, filename, caption) === "shared") setStatus("shared");
    } catch {
      // The link and platform buttons still work.
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Share profile" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border bg-background shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold"><UserRound className="size-4 text-amber-500" /> Share {target.own ? "your" : `${target.name}'s`} profile</h2>
            <p className="text-[11px] text-muted-foreground">The link opens the profile and previews with this card. It updates as new runs come in.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-64 place-items-center bg-muted/35 p-3 sm:p-6">
          {status === "loading" ? (
            <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
          ) : previewUrl ? (
            <img src={previewUrl} alt={`${target.name}'s Codey profile card`} className="max-h-[60vh] w-full rounded-xl border object-contain shadow-2xl" />
          ) : (
            <p className="max-w-sm text-center text-sm text-muted-foreground">The card preview is not available here, but the link below still shares the profile with its card.</p>
          )}
        </div>

        <SharePostPanel text={text} url={url} hint="Anyone with the link sees the card as its preview. For Instagram stories, download the image and post it there." />

        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={copyCaption} className="text-xs text-muted-foreground hover:text-foreground">
            {copiedCaption ? <Check data-icon="inline-start" className="size-3.5 text-green-500" /> : <Copy data-icon="inline-start" className="size-3.5" />}
            {copiedCaption ? "Caption Copied!" : "Copy Post Caption"}
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&>*:last-child]:col-span-2">
            <Button type="button" variant="outline" onClick={() => void copyImage()} disabled={!blob}>
              {copiedImage ? <Check data-icon="inline-start" className="text-green-500" /> : <Copy data-icon="inline-start" />}
              {copiedImage ? "Copied to Clipboard!" : "Copy Image"}
            </Button>
            <Button type="button" variant="outline" onClick={() => blob && downloadBlob(blob, filename)} disabled={!blob}>
              <Download data-icon="inline-start" /> Download PNG
            </Button>
            <Button type="button" onClick={() => void share()} disabled={!blob}>
              {status === "shared" ? <Check data-icon="inline-start" /> : <Share2 data-icon="inline-start" />}
              {status === "shared" ? "Shared" : "Share Image"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
