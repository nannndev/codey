import { Link } from "react-router-dom";
import { ArrowLeft, Award } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider";
import { AchievementBadge } from "@/components/achievements/Badge";
import { TIER_NAMES, TOTAL_ACHIEVEMENTS, achievementId, type FamilyProgress, type Tier } from "@/lib/achievements";
import { useAchievements } from "@/hooks/useAchievements";
import { cn } from "@/lib/utils";

export function formatAmount(value: number, unit: string) {
  if (unit === "keys") return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M` : value >= 1000 ? `${Math.floor(value / 1000)}k` : `${value}`;
  if (unit === "min") return value >= 120 ? `${Math.floor(value / 60)}h` : `${value}m`;
  return `${Math.floor(value)}`;
}

const unitLabel = (unit: string, amount = 2) => (unit === "min" || unit === "keys" ? "" : ` ${amount === 1 ? unit.replace(/s$/, "") : unit}`);
const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

function FamilyCard({ item, unlockedAt }: { item: FamilyProgress; unlockedAt: Record<string, number> }) {
  const { family, value, tier, next, progress } = item;
  return (
    <section className="rounded-2xl border bg-card/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{family.name}</h2>
          <p className="text-xs text-muted-foreground">{next === null ? "Every tier earned" : family.goal(next)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", tier ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
          {tier ? TIER_NAMES[tier] : "Not started"}
        </span>
      </div>
      <ol className="mt-3 grid grid-cols-4 gap-1">
        {family.tiers.map((target, index) => {
          const t = (index + 1) as Tier;
          const earned = tier >= t;
          const when = unlockedAt[achievementId(family.id, t)];
          return (
            <li key={t} className="flex flex-col items-center text-center" title={earned ? `${family.name} ${TIER_NAMES[t]}${when ? ` · earned ${dateFormat.format(when)}` : ""}` : family.goal(target)}>
              <AchievementBadge kind={family.id} tier={t} locked={!earned} size={64} label={`${family.name} ${TIER_NAMES[t]}${earned ? "" : ", locked"}`} />
              <span className={cn("mt-1 font-mono text-[11px] tabular-nums", earned ? "font-bold" : "text-muted-foreground")}>
                {formatAmount(target, family.unit)}{unitLabel(family.unit, target)}
              </span>
            </li>
          );
        })}
      </ol>
      {next !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Next: {TIER_NAMES[((tier as number) + 1) as Tier]}</span>
            <span className="font-mono tabular-nums">{formatAmount(value, family.unit)} / {formatAmount(next, family.unit)}{unitLabel(family.unit)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={`${family.name} progress`}>
            <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${Math.max(2, progress * 100)}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}

export default function Achievements() {
  const { user } = useAuth();
  const { evaluation, unlockedAt, syncing } = useAchievements({ userId: user?.$id, own: true });
  const earned = evaluation.earned.size;
  const nextUp = [...evaluation.families].filter((item) => item.next !== null).sort((a, b) => b.progress - a.progress).slice(0, 3);
  const recent = Object.entries(unlockedAt).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Header />
        <Link to="/profile" className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to profile
        </Link>

        <header className="mb-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
              <Award className="size-3.5" /> Badges
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Achievements</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {user ? "Saved to your account and shared across your devices." : "Sign in to keep these on your account and every device."} Each family has four tiers, from Bronze to Diamond.
            </p>
          </div>
          <div className="rounded-2xl border bg-card/80 p-4 md:w-72">
            <p className="text-xs text-muted-foreground">Earned</p>
            <p className="font-mono text-3xl font-black tabular-nums">{earned}<span className="text-base font-semibold text-muted-foreground"> / {TOTAL_ACHIEVEMENTS}</span></p>
            <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(earned / TOTAL_ACHIEVEMENTS) * 100}%` }} /></div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {syncing ? "Syncing with your account…" : recent ? `Latest: ${dateFormat.format(recent[1])}` : "None yet"}
            </p>
          </div>
        </header>

        {nextUp.length > 0 && (
          <section className="mb-4 rounded-2xl border bg-card/80 p-4 sm:p-5">
            <h2 className="text-sm font-bold">Closest next</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {nextUp.map((item) => {
                const nextTier = ((item.tier as number) + 1) as Tier;
                return (
                  <li key={item.family.id} className="flex items-center gap-3">
                    <AchievementBadge kind={item.family.id} tier={nextTier} locked size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{item.family.name} {TIER_NAMES[nextTier]}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{item.family.goal(item.next!)}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(2, item.progress * 100)}%` }} /></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {evaluation.families.map((item) => (
            <FamilyCard key={item.family.id} item={item} unlockedAt={unlockedAt} />
          ))}
        </div>

        <section className="mt-4 rounded-2xl border bg-card/80 p-4 sm:p-5">
          <h2 className="text-sm font-bold">Feats</h2>
          <p className="text-xs text-muted-foreground">One-off badges for special moments.</p>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {evaluation.singles.map(({ single, unlocked }) => (
              <li key={single.id} className="flex flex-col items-center text-center">
                <AchievementBadge kind={single.id} locked={!unlocked} size={72} label={`${single.name}${unlocked ? "" : ", locked"}`} />
                <p className={cn("mt-1.5 text-xs font-bold", !unlocked && "text-muted-foreground")}>{single.name}</p>
                <p className="text-[11px] text-muted-foreground">{single.goal}</p>
                {unlocked && unlockedAt[single.id] && <p className="mt-0.5 text-[10px] text-muted-foreground">{dateFormat.format(unlockedAt[single.id])}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <Footer />
    </div>
  );
}
