import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { DIVISION_COLORS, DIVISION_TEXT, DIVISIONS, LEAGUE_XP_EVENT, type XpGain } from "@/lib/social";
import { cn } from "@/lib/utils";

/** "+32 XP · Silver league" once the finished run has been counted. */
export function LeagueXpChip() {
  const [gain, setGain] = useState<XpGain | null>(null);
  useEffect(() => {
    const onGain = (event: Event) => setGain((event as CustomEvent<XpGain>).detail);
    window.addEventListener(LEAGUE_XP_EVENT, onGain);
    return () => window.removeEventListener(LEAGUE_XP_EVENT, onGain);
  }, []);
  if (!gain?.gained) return null;
  const division = gain.division ?? 0;
  return (
    <div className="flex justify-center animate-scale-in">
      <Link
        to="/league"
        className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold transition-colors hover:bg-muted", DIVISION_TEXT[division])}
        style={{ borderColor: `${DIVISION_COLORS[division]}88` }}
      >
        <Shield className="size-3.5" /> +{gain.gained} XP
        <span className="font-semibold text-muted-foreground">· {DIVISIONS[division]} league{gain.weekXp ? ` · ${gain.weekXp} this week` : ""}</span>
      </Link>
    </div>
  );
}
