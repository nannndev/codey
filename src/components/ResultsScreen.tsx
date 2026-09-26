import type { RunResult, PersonalBest, Snippet } from "@/types";
import { Button } from "@/components/ui/button";
import { ErrorHeatmap } from "@/components/ErrorHeatmap";
import { WeakKeys } from "@/components/WeakKeys";
import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ArrowRight, Trophy, ImageDown, Zap, ShieldCheck, GitPullRequest } from "lucide-react";
import { useAuth, githubUsernameFromUser } from "@/components/AuthProvider";
import type { ShareCardOptions } from "@/lib/share-result";
import { SharePreviewDialog } from "@/components/SharePreviewDialog";
import { HoloResultCard, resultTier } from "@/components/HoloResultCard";
import { rankRejectionReason, describeRankRejection } from "@/utils/ranking";
import type { RankedStatus } from "@/hooks/useRankedGame";
import { cn } from "@/lib/utils";

interface ResultsScreenProps {
  result: RunResult;
  previousBest: PersonalBest | null;
  verifiedResult?: { verified: boolean; wpm: number; accuracy: number; runId?: string } | null;
  rankedStatus?: RankedStatus;
  rankedError?: string | null;
  onRetry: () => void;
  onNext: () => void;
  onDrill: (snippet: Snippet) => void;
}

export function ResultsScreen({
  result,
  previousBest,
  verifiedResult,
  rankedStatus,
  rankedError,
  onRetry,
  onNext,
  onDrill,
}: ResultsScreenProps) {
  const { user } = useAuth();
  const [shareOptions, setShareOptions] = useState<ShareCardOptions | null>(null);

  const modeLabel =
    result.mode === "timed"
      ? `${result.duration / 1000}s Timed`
      : result.mode === "zen"
      ? "Zen Flow"
      : `${result.snippetLength ? `${result.snippetLength.charAt(0).toUpperCase()}${result.snippetLength.slice(1)} ` : ""}Snippet`;

  const isNewWpmRecord = previousBest ? result.wpm > previousBest.bestWpm : true;
  const isNewAccuracyRecord = previousBest ? result.accuracy > previousBest.bestAccuracy : true;
  const hasAnyRecord = isNewWpmRecord || isNewAccuracyRecord;
  const isCustom = result.sourceType === "custom";
  const rejection = rankRejectionReason(result);

  const tier = resultTier(result.wpm);
  const username = user ? githubUsernameFromUser(user) || user.name || undefined : undefined;

  return (
    <div className="mt-8 flex animate-fade-in-up flex-col gap-6 max-w-3xl mx-auto">
      {/* Title & Badge */}
      <div className="text-center flex flex-col items-center gap-2">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider font-mono"
          style={{ color: tier.accent, borderColor: `${tier.accent}55`, backgroundColor: `${tier.accent}1a` }}
        >
          <span>⚡ {tier.label}</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-foreground font-sans">
          Run Completed · <span className="text-amber-500">{modeLabel}</span>
        </h2>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          {result.language} Ecosystem
        </p>
      </div>

      <HoloResultCard
        result={result}
        previousBest={previousBest}
        modeLabel={modeLabel}
        username={username}
      />

      {/* Ranked Score Banner / Verification */}
      {verifiedResult?.verified && (
        <div className="flex justify-center animate-scale-in">
          <span className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-xs font-bold text-amber-500 shadow-xs">
            <ShieldCheck className="size-4" />
            <span>Anti-Cheat Verified · Ranked Leaderboard Placed!</span>
          </span>
        </div>
      )}

      {rankedStatus === "submitting" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs font-semibold text-amber-500">
          Verifying Ranked telemetry with server...
        </div>
      )}

      {rankedStatus === "rejected" && rankedError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-xs font-semibold text-rose-500">
          Ranked run rejected: {rankedError}
        </div>
      )}

      {!isCustom && hasAnyRecord && !verifiedResult?.verified && (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-4 py-1 text-xs font-bold text-amber-500">
            <Trophy className="size-3.5" />
            New Personal Best Record!
          </span>
        </div>
      )}

      {result.language.toLowerCase() === "diff" && (
        <div className="flex justify-center animate-scale-in">
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 px-4 py-2 text-xs font-bold text-emerald-500 shadow-xs">
            <GitPullRequest className="size-4 shrink-0" />
            <span>Pull Request Approved & Merged! Code Review Sprint Complete 🚀</span>
          </div>
        </div>
      )}

      {isCustom ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
          Local drill result · not added to cloud history or global leaderboard.
        </div>
      ) : rejection ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
          Saved to local history. {describeRankRejection(rejection)}
        </div>
      ) : null}

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { label: "Raw Speed", value: `${result.rawWpm.toFixed(1)} WPM` },
          { label: "Max Streak", value: `${result.maxCombo ?? 0} 🔥` },
          { label: "Consistency", value: `${result.consistency.toFixed(1)}%` },
          { label: "Errors", value: String(result.totalErrors) },
          { label: "Total Chars", value: String(result.charsTyped) },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-3.5 text-center shadow-xs">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 font-sans">{s.label}</p>
            <p className="text-base sm:text-lg font-black font-mono tabular-nums text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Per-line Accuracy */}
      {result.perLineStats.length > 0 && (
        <div className="glass-card rounded-2xl p-4 flex flex-col gap-2.5">
          <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground font-sans">Per-Line Accuracy</p>
          <div className="flex flex-col gap-2">
            {result.perLineStats.map((ls) => (
              <div key={ls.lineIndex} className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-muted-foreground w-7 text-right tabular-nums">
                  L{ls.lineIndex + 1}
                </span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      ls.accuracy >= 95 ? "bg-emerald-500" : ls.accuracy >= 85 ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${ls.accuracy}%` }}
                  />
                </div>
                <span className="w-12 text-right text-[11px] font-mono tabular-nums text-muted-foreground font-semibold">
                  {ls.accuracy.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Heatmap */}
      {result.errorPositions.length > 0 && (
        <div className="glass-card rounded-2xl p-4 flex flex-col gap-2.5">
          <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground font-sans">
            Typing Error Map ({result.errorPositions.length} mistakes)
          </p>
          <ErrorHeatmap errorPositions={result.errorPositions} totalChars={result.charsTyped} />
        </div>
      )}

      {/* Weak Keys Drill Trigger */}
      <WeakKeys refreshKey={result.timestamp} onDrill={onDrill} />

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-3 mt-2">
        <div className="flex flex-col sm:flex-row gap-2.5 w-full">
          <Button
            onClick={() =>
              // A verified Ranked run is shared by the copy the server stored.
              setShareOptions({ result: verifiedResult?.verified && verifiedResult.runId ? { ...result, cloudId: verifiedResult.runId } : result, username })
            }
            variant="outline"
            size="lg"
            className="flex-1 h-11 rounded-xl font-bold bg-foreground text-background hover:bg-foreground/90 hover:text-background border-transparent shadow-xs"
          >
            <ImageDown className="size-4 mr-2" /> Share Result Card
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="flex-1 h-11 rounded-xl font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
          >
            <Link to="/analytics/keyboard">
              <Zap className="size-4 mr-2" /> Keyboard Analytics
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 w-full">
          <Button onClick={onRetry} size="lg" className="flex-1 h-11 rounded-xl font-bold shadow-md">
            <RefreshCw className="size-4 mr-2" /> Try Again (Enter)
          </Button>

          <Button onClick={onNext} variant="outline" size="lg" className="flex-1 h-11 rounded-xl font-bold">
            <ArrowRight className="size-4 mr-2" /> Next Snippet
          </Button>
        </div>
      </div>

      <SharePreviewDialog options={shareOptions} onClose={() => setShareOptions(null)} />
    </div>
  );
}
