import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Cloud, CloudOff, Flame, Gauge, Hand, Hash, Keyboard, Sparkles, Target, Timer, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { KeyboardSkyline } from "@/components/analytics/KeyboardSkyline";
import { KEYBOARD_ROWS } from "@/lib/keyboard-layout";
import { LEGENDS, computeColumns, drillCharFor, fingerBreakdown, rankKeys, summarize, type KeyMetric } from "@/lib/key-metrics";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { KeyboardHeatmap } from "@/components/KeyboardHeatmap";
import { useAuth } from "@/components/AuthProvider";
import { getCloudKeyboardStats } from "@/lib/keyboard-stats-cloud";
import {
  FINGER_MAP,
  getPendingKeyboardStats,
  getVisibleKeyStats,
  mergeStatsMaps,
  type KeyStat,
  type KeyboardStatsMap,
} from "@/utils/keyboard-analytics";

export default function KeyboardAnalytics() {
  const { user } = useAuth();
  const [cloudStats, setCloudStats] = useState<KeyboardStatsMap | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.$id) {
      setCloudStats(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getCloudKeyboardStats()
      .then((stats) => {
        if (!cancelled) setCloudStats(stats);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.$id]);

  const stats = useMemo(() => {
    const local = getVisibleKeyStats(user?.$id);
    if (!user?.$id || !cloudStats) return local;
    const pending = getPendingKeyboardStats(user.$id)?.stats || {};
    return Object.keys(cloudStats).length || Object.keys(pending).length
      ? mergeStatsMaps(cloudStats, pending)
      : local;
  }, [cloudStats, user?.$id]);

  const [metric, setMetric] = useState<KeyMetric>("accuracy");
  const [view, setView] = useState<"3d" | "2d">("3d");
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();

  const summary = useMemo(() => summarize(stats), [stats]);
  const columns = useMemo(() => computeColumns(stats, metric), [stats, metric]);
  const fingers = useMemo(() => fingerBreakdown(stats), [stats]);
  const weakest = useMemo(() => rankKeys(stats, "accuracy"), [stats]);
  const slowest = useMemo(() => rankKeys(stats, "speed"), [stats]);
  const weakestFinger = useMemo(
    () => [...fingers].filter((finger) => finger.presses >= 20).sort((a, b) => a.accuracy - b.accuracy)[0],
    [fingers],
  );
  const selectedStat = selected ? stats[selected] : undefined;
  const selectedLabel = selected ? KEYBOARD_ROWS.flat().find((key) => key.id === selected)?.label || "Space" : "";
  const drillChar = selected ? drillCharFor(selected) : null;
  const legend = LEGENDS[metric];

  const focusKey = (id: string) => {
    setView("3d");
    setSelected(id);
    document.getElementById("keyboard-skyline")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const hasData = summary.keystrokes > 0;

  return (
    <div className="workspace-shell min-h-screen bg-background">
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Header />
        <main className="mt-8 space-y-6 animate-fade-in-up">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3.5" /> Back to typing
              </Link>
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl">
                <Keyboard className="size-8 text-amber-500" /> Keyboard analytics
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Accuracy, speed and load for every physical key and finger. Only aggregate counts are stored; typed content never leaves your browser.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/75 px-3 py-1.5 text-xs text-muted-foreground">
              {user ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />}
              {loading ? "Reading cloud telemetry…" : user ? "Cloud + this device" : "This device only"}
            </div>
          </div>

          {!hasData ? (
            <div className="grid place-items-center gap-3 rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center">
              <Keyboard className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No keystrokes recorded yet. Finish a run and your keyboard builds itself here.</p>
              <Button asChild size="sm" className="bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"><Link to="/">Start typing</Link></Button>
            </div>
          ) : (
            <>
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
                <KpiTile icon={Hash} label="Keystrokes" value={summary.keystrokes.toLocaleString()} sub={`${summary.tracked} keys tracked`} />
                <KpiTile icon={Target} label="Accuracy" value={`${summary.accuracy.toFixed(1)}%`} sub="all keys" tone={summary.accuracy >= 95 ? "good" : summary.accuracy >= 90 ? "warn" : "bad"} />
                <KpiTile icon={Gauge} label="Avg latency" value={`${summary.latency} ms`} sub="between keystrokes" />
                <KpiTile
                  icon={Hand}
                  label="Weakest finger"
                  value={weakestFinger ? weakestFinger.name : "–"}
                  sub={weakestFinger ? `${weakestFinger.accuracy.toFixed(1)}% accuracy` : "needs more data"}
                  accent={weakestFinger?.color}
                />
              </section>

              <section id="keyboard-skyline" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="overflow-hidden rounded-2xl border bg-card/70 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="flex items-center gap-0.5 rounded-lg border bg-background/60 p-0.5" role="group" aria-label="Metric">
                      {METRICS.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setMetric(id)}
                          aria-pressed={metric === id}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${metric === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <Icon className="size-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-0.5 rounded-lg border bg-background/60 p-0.5 text-xs font-bold" role="group" aria-label="View">
                      {(["3d", "2d"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setView(mode)}
                          aria-pressed={view === mode}
                          className={`rounded-md px-2.5 py-1.5 uppercase transition-colors ${view === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {view === "3d" ? (
                    <KeyboardSkyline
                      columns={columns}
                      stats={stats}
                      selected={selected}
                      onSelect={setSelected}
                      fallback={<div className="p-4"><KeyboardHeatmap statsMap={stats} /></div>}
                    />
                  ) : (
                    <div className="p-4"><KeyboardHeatmap statsMap={stats} /></div>
                  )}

                  {view === "3d" && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{legend.title}</span>
                      {legend.gradient ? (
                        <span className="flex items-center gap-2">
                          {legend.low}
                          <span className="h-2 w-28 rounded-full" style={{ background: legend.gradient }} />
                          {legend.high}
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          {fingers.map((finger) => (
                            <span key={finger.name} className="inline-flex items-center gap-1">
                              <span className="size-2.5 rounded-sm" style={{ background: finger.color }} /> {finger.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <aside className="flex flex-col gap-3 rounded-2xl border bg-card/70 p-4" aria-live="polite">
                  {selected ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="grid min-w-14 place-items-center rounded-xl border-b-4 border-amber-600 bg-amber-500 px-3 py-2 font-mono text-2xl font-black text-zinc-950">
                          {selectedLabel}
                        </span>
                        {FINGER_MAP[selected] && (
                          <span className="rounded-md border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: FINGER_MAP[selected].color, color: FINGER_MAP[selected].color }}>
                            {FINGER_MAP[selected].name}
                          </span>
                        )}
                        <button type="button" onClick={() => setSelected(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground" aria-label="Clear selection">
                          <X className="size-4" />
                        </button>
                      </div>
                      {selectedStat ? (
                        <>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <MiniStat label="Accuracy" value={`${selectedStat.accuracy.toFixed(1)}%`} />
                            <MiniStat label="Latency" value={`${selectedStat.avgDelayMs} ms`} />
                            <MiniStat label="Presses" value={selectedStat.totalPresses.toLocaleString()} />
                          </div>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            <li>{compare(selectedStat.accuracy - summary.accuracy, "pt", "more accurate", "less accurate")} than your average</li>
                            <li>{compare(summary.latency - selectedStat.avgDelayMs, "ms", "faster", "slower")} than your average</li>
                            <li>{selectedStat.errors.toLocaleString()} missed of {selectedStat.totalPresses.toLocaleString()}</li>
                          </ul>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">This key hasn't been pressed in a run yet.</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        disabled={!drillChar}
                        onClick={() => drillChar && navigate(`/?drill=${encodeURIComponent(drillChar)}`)}
                        className="mt-auto h-9 bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
                      >
                        <Sparkles className="size-3.5" /> {drillChar ? `Practice '${selectedLabel}'` : "Drills cover printable keys"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start here</p>
                      <p className="text-sm">Click any key in the 3D board, or pick one of your trouble keys:</p>
                      <div className="flex flex-wrap gap-2">
                        {weakest.slice(0, 4).map((stat) => (
                          <button
                            key={stat.key}
                            type="button"
                            onClick={() => setSelected(stat.key)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/20"
                          >
                            <span className="font-mono">{labelFor(stat.key)}</span>
                            <span className="text-[10px] font-semibold text-muted-foreground">{stat.accuracy.toFixed(0)}%</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-auto text-[11px] text-muted-foreground">
                        Switch metrics above: Accuracy shows where you miss, Speed where you hesitate, Usage where the load is.
                      </p>
                    </>
                  )}
                </aside>
              </section>

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="rounded-2xl border bg-card/70 p-4">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Hand className="size-4 text-amber-500" /> Fingers</h2>
                  <div className="space-y-2.5">
                    {fingers.map((finger) => (
                      <div key={finger.name} className="grid grid-cols-[96px_minmax(0,1fr)_104px] items-center gap-3 text-xs">
                        <span className="truncate font-semibold">{finger.name}</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div className="finger-bar h-full rounded-full" style={{ width: `${Math.max(3, finger.share * 100 / Math.max(...fingers.map((f) => f.share)))}%`, background: finger.color }} />
                        </div>
                        <span className="text-right font-mono tabular-nums text-muted-foreground">
                          <b className={finger.accuracy >= 95 ? "text-emerald-500" : finger.accuracy >= 90 ? "text-amber-500" : "text-red-500"}>{finger.accuracy.toFixed(1)}%</b> · {finger.latency}ms
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-muted-foreground">Bar length = share of keystrokes. Numbers: accuracy · average latency.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <KeyList title="Most missed" icon={Flame} items={weakest} value={(stat) => `${stat.accuracy.toFixed(1)}%`} tone="bad" onPick={focusKey} />
                  <KeyList title="Slowest" icon={Timer} items={slowest} value={(stat) => `${stat.avgDelayMs} ms`} tone="warn" onPick={focusKey} />
                </div>
              </section>
            </>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}

const METRICS: Array<{ id: KeyMetric; label: string; icon: typeof Target }> = [
  { id: "accuracy", label: "Accuracy", icon: Target },
  { id: "speed", label: "Speed", icon: Gauge },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "fingers", label: "Fingers", icon: Hand },
];

function labelFor(id: string) {
  return KEYBOARD_ROWS.flat().find((key) => key.id === id)?.label || "Space";
}

function compare(diff: number, unit: string, better: string, worse: string) {
  const rounded = unit === "ms" ? Math.round(Math.abs(diff)) : Math.abs(diff).toFixed(1);
  if (Number(rounded) === 0) return "About the same";
  return `${rounded} ${unit} ${diff > 0 ? better : worse}`;
}

function KpiTile({ icon: Icon, label, value, sub, tone, accent }: {
  icon: typeof Target;
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "warn" | "bad";
  accent?: string;
}) {
  const toneClass = tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : tone === "bad" ? "text-red-500" : "";
  return (
    <div className="kpi-tile rounded-2xl border bg-card/70 p-4" style={accent ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
      <p className={`mt-2 truncate font-mono text-xl font-black tabular-nums sm:text-3xl ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/40 px-1.5 py-2">
      <p className="font-mono text-sm font-black tabular-nums">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function KeyList({ title, icon: Icon, items, value, tone, onPick }: {
  title: string;
  icon: typeof Target;
  items: KeyStat[];
  value: (stat: KeyStat) => string;
  tone: "bad" | "warn";
  onPick: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card/70 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Icon className={`size-4 ${tone === "bad" ? "text-red-500" : "text-amber-500"}`} /> {title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not enough presses yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((stat, index) => (
            <li key={stat.key}>
              <button type="button" onClick={() => onPick(stat.key)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted">
                <span className="w-4 text-[10px] text-muted-foreground">{index + 1}</span>
                <span className="grid min-w-8 place-items-center rounded-md border-b-2 bg-muted px-1.5 py-0.5 font-mono text-sm font-black">{labelFor(stat.key)}</span>
                <span className={`ml-auto font-mono font-bold tabular-nums ${tone === "bad" ? "text-red-500" : "text-amber-500"}`}>{value(stat)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
