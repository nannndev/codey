import { useEffect, useState } from "react";
import { ChevronDown, Cloud, Clock3, Keyboard, Target, CheckCircle2 } from "lucide-react";
import { getDailyGoalProgress } from "@/utils/storage";
import { useAuth } from "@/components/AuthProvider";
import { getCloudDailyGoalProgress } from "@/lib/cloud";
import { cn } from "@/lib/utils";

function GoalRow({
  icon: Icon,
  label,
  value,
  goal,
  suffix = "",
}: {
  icon: typeof Target;
  label: string;
  value: number;
  goal: number;
  suffix?: string;
}) {
  const percent = goal > 0 ? Math.min(100, (value / goal) * 100) : 100;
  const isComplete = percent >= 100;
  const displayValue = suffix === " min" ? Math.round(value * 10) / 10 : Math.round(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground font-sans font-medium">
          <Icon className={cn("size-3.5", isComplete ? "text-emerald-500" : "text-amber-500")} />
          {label}
        </span>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
          {displayValue}
          {suffix} / {goal}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary/80">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isComplete
              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              : "bg-gradient-to-r from-amber-500 to-yellow-400"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function DailyGoals({ refreshKey, compact = false }: { refreshKey?: number; compact?: boolean }) {
  const { user } = useAuth();
  const [progress, setProgress] = useState(getDailyGoalProgress);

  useEffect(() => {
    const local = getDailyGoalProgress();
    setProgress(local);
    if (!user) return;
    void getCloudDailyGoalProgress(user.$id)
      .then((cloud) => setProgress({ ...cloud, goals: getDailyGoalProgress().goals }))
      .catch(() => setProgress(local));
  }, [user, refreshKey]);

  const completed = [
    progress.runs >= progress.goals.runsPerDay,
    progress.minutes >= progress.goals.minutesPerDay,
    progress.chars >= progress.goals.charsPerDay,
  ].filter(Boolean).length;

  if (compact) {
    return (
      <details className="group rounded-xl glass-card transition-all duration-200 shadow-xs">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs text-muted-foreground marker:content-none hover:text-foreground">
          <span className="flex items-center gap-2">
            <Target className="size-4 text-amber-500" />
            <strong className="text-foreground font-semibold font-sans">Daily Goals</strong>
            <span className="text-[11px] font-mono">
              {progress.runs}/{progress.goals.runsPerDay} runs · {Math.round(progress.minutes * 10) / 10}/
              {progress.goals.minutesPerDay} min · {progress.chars}/{progress.goals.charsPerDay} chars
            </span>
            {completed === 3 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0 text-[10px] font-bold text-emerald-500">
                <CheckCircle2 className="size-3" /> Done
              </span>
            )}
            {user && <Cloud className="size-3 text-muted-foreground/80" aria-label="Synced with Appwrite" />}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t border-border/50 px-4 py-3.5 sm:grid-cols-3 animate-fade-in-up">
          <GoalRow icon={Target} label="Completed runs" value={progress.runs} goal={progress.goals.runsPerDay} />
          <GoalRow
            icon={Clock3}
            label="Practice time"
            value={progress.minutes}
            goal={progress.goals.minutesPerDay}
            suffix=" min"
          />
          <GoalRow icon={Keyboard} label="Characters typed" value={progress.chars} goal={progress.goals.charsPerDay} />
        </div>
      </details>
    );
  }

  return (
    <section className="rounded-2xl glass-card p-5 shadow-sm" aria-label="Today's goals">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground font-sans">Daily Goals</p>
          <p className="text-[11px] text-muted-foreground">
            {user ? "Synced with cloud account" : "Local progress resets at midnight"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-mono font-bold tabular-nums shadow-xs",
            completed === 3
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
              : "border-border/70 text-foreground"
          )}
        >
          {completed}/3 Completed
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <GoalRow icon={Target} label="Completed runs" value={progress.runs} goal={progress.goals.runsPerDay} />
        <GoalRow
          icon={Clock3}
          label="Practice time"
          value={progress.minutes}
          goal={progress.goals.minutesPerDay}
          suffix=" min"
        />
        <GoalRow icon={Keyboard} label="Characters typed" value={progress.chars} goal={progress.goals.charsPerDay} />
      </div>
    </section>
  );
}
