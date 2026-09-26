import { useEffect, useState } from "react";
import { Check, Copy, Download, LogIn, LoaderCircle, Share2, Sparkles, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createResultCard, SHARE_THEMES, type ShareCardOptions, type ShareCardTheme } from "@/lib/share-result";
import { usePreferences } from "@/components/PreferencesProvider";
import { getColorway } from "@/lib/keycaps";
import { githubUsernameFromUser, useAuth } from "@/components/AuthProvider";
import { challengeShareText, challengeShareUrl, createChallenge } from "@/lib/challenges";
import { shareableRunId } from "@/lib/cloud";
import { runCardUrl, runShareUrl, shareCaption, shareText } from "@/lib/share-links";
import { copyBlob, downloadBlob, fetchCardImage, shareBlob } from "@/lib/share-image";
import { SharePostPanel } from "@/components/SharePostPanel";

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
  // undefined while the link is being prepared; null when the run has no public page.
  const [runId, setRunId] = useState<string | null | undefined>(undefined);
  const { preferences } = usePreferences();
  const { user, login } = useAuth();
  const [tab, setTab] = useState<"score" | "challenge">("score");
  const [challenge, setChallenge] = useState<{ status: "idle" | "creating" | "ready" | "error"; url?: string }>({ status: "idle" });
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
      ? fetchCardImage(runCardUrl(window.location.origin, runId))
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
    setTab(options?.startWithChallenge && options.challenge ? "challenge" : "score");
    setChallenge({ status: "idle" });
  }, [options]);

  // The challenge is saved the first time its tab opens.
  useEffect(() => {
    if (!options?.challenge || tab !== "challenge" || !user || challenge.status !== "idle") return;
    setChallenge({ status: "creating" });
    void createChallenge({ id: user.$id, name: user.name || githubUsernameFromUser(user) || "", username: githubUsernameFromUser(user) }, options.challenge, options.result)
      .then((id) => setChallenge({ status: "ready", url: challengeShareUrl(window.location.origin, id) }))
      .catch(() => setChallenge({ status: "error" }));
  }, [options, tab, user, challenge.status]);

  useEffect(() => {
    if (!options) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [options, onClose]);

  if (!options) return null;
  const filename = `codey-${Math.round(options.result.wpm)}wpm.png`;
  const canNativeShare = typeof navigator.share === "function";

  const text = shareText(options.result, options.rank);
  const caption = shareCaption(text, shareUrl ?? window.location.origin);
  const download = () => { if (blob) downloadBlob(blob, filename); };

  const copyImage = async () => {
    if (!blob) return;
    if (await copyBlob(blob, filename)) {
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
      setStatus("error");
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

        {options.challenge && (
          <div className="flex items-center gap-1 border-t px-4 pt-3 sm:px-5" role="tablist" aria-label="What to share">
            {([["score", "Share score", Share2], ["challenge", "Challenge a friend", Swords]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        )}

        {tab === "challenge" && options.challenge ? (
          user ? (
            challenge.status === "error" ? (
              <div className="px-4 pt-4 text-xs text-red-500 sm:px-5">
                Could not create the challenge. <button type="button" className="font-semibold underline" onClick={() => setChallenge({ status: "idle" })}>Try again</button>
              </div>
            ) : (
              <SharePostPanel
                text={challengeShareText({ wpm: options.result.wpm, language: options.result.language }, true)}
                url={challenge.url ?? null}
                hint="Your friend types this exact snippet against your score, then sees who was faster. No account needed to accept."
              />
            )
          ) : (
            <div className="mx-4 mt-4 flex flex-col items-start gap-2 rounded-xl border bg-muted/40 p-4 sm:mx-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Sign in to turn this run into a challenge link your friends can race.</p>
              <Button type="button" size="sm" onClick={login}><LogIn data-icon="inline-start" /> Sign in with GitHub</Button>
            </div>
          )
        ) : (
        <SharePostPanel
          text={text}
          url={shareUrl}
          hint={runId
            ? "The link shows your score card as its preview. For Instagram stories, download the image and post it there."
            : "Sign in to get a link with your own score card. For Instagram, download the image and post it there."}
        />
        )}

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
