import { useMemo, useState } from "react";
import { CalendarRange, Share2, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth, githubUsernameFromUser } from "@/components/AuthProvider";
import { ImageShareDialog, type ImageShare } from "@/components/ImageShareDialog";
import { createRecapCard } from "@/lib/recap-card";
import { profileShareUrl } from "@/lib/share-links";
import { recapText, weeklyRecap } from "@/lib/weekly-recap";
import { formatMinutes, type RunLike } from "@/lib/run-stats";
import { cn } from "@/lib/utils";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** This week at a glance, compared with last week, with a shareable card. */
export function WeeklyRecapCard({ runs }: { runs: RunLike[] }) {
  const recap = useMemo(() => weeklyRecap(runs), [runs]);
  const { user } = useAuth();
  const [share, setShare] = useState<ImageShare | null>(null);
  const { thisWeek, lastWeek, wpmDelta } = recap;
  const most = Math.max(1, ...thisWeek.perDay);
  const today = (new Date().getDay() + 6) % 7;
  const username = user ? githubUsernameFromUser(user) : undefined;

  const openShare = () => setShare({
    title: "Share your week",
    subtitle: "Your weekly recap as an image, ready for stories and posts.",
    icon: CalendarRange,
    load: () => createRecapCard(recap, { name: user?.name || username || undefined, username }),
    text: recapText(recap),
    url: user ? profileShareUrl(window.location.origin, user.$id) : window.location.origin,
    hint: user ? "The link opens your Codey profile. For Instagram stories, download the image." : "Sign in to link your profile. For Instagram stories, download the image.",
    filename: "codey-week.png",
  });

  return (
    <section className="rounded-2xl border bg-card/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400"><CalendarRange className="size-3.5" /> This week</p>
          <p className="mt-1 text-lg font-black tracking-tight">
            {thisWeek.runs ? `${thisWeek.runs} ${thisWeek.runs === 1 ? "run" : "runs"} · ${thisWeek.avgWpm.toFixed(1)} WPM average` : "No runs yet this week"}
          </p>
          <p className="text-xs text-muted-foreground">
            {thisWeek.runs ? `${formatMinutes(thisWeek.minutes)} typed on ${thisWeek.days} ${thisWeek.days === 1 ? "day" : "days"}${thisWeek.topLanguage ? ` · mostly ${thisWeek.topLanguage}` : ""}` : lastWeek.runs ? `Last week: ${lastWeek.runs} runs at ${lastWeek.avgWpm.toFixed(1)} WPM.` : "Finish a run to start your week."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {wpmDelta !== null && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", wpmDelta >= 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400")}>
              {wpmDelta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {wpmDelta >= 0 ? "+" : ""}{wpmDelta.toFixed(1)} WPM vs last week
            </span>
          )}
          <button type="button" onClick={openShare} disabled={!thisWeek.runs} className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40">
            <Share2 className="size-3.5" /> Share week
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-2" aria-label="Runs per day this week">
        {thisWeek.perDay.map((count, index) => (
          <div key={index} className="flex flex-col items-center gap-1.5">
            <div className="flex h-14 w-full items-end">
              <div
                className={cn("w-full rounded-md transition-all", count ? "bg-amber-500" : "bg-muted", index > today && "opacity-40")}
                style={{ height: `${count ? 25 + (count / most) * 75 : 12}%` }}
                title={`${count} ${count === 1 ? "run" : "runs"}`}
              />
            </div>
            <span className={cn("text-[10px] font-semibold", index === today ? "text-foreground" : "text-muted-foreground")}>{DAYS[index]}</span>
          </div>
        ))}
      </div>
      <ImageShareDialog share={share} onClose={() => setShare(null)} />
    </section>
  );
}
