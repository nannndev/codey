import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Check,
  Crown,
  Eye,
  FileCode2,
  Flag,
  Globe2,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  Shuffle,
  Timer,
  UserX,
  Users,
  Zap,
} from "lucide-react";
import { CustomPractice } from "@/components/CustomPractice";
import { MAX_CUSTOM_CHARS, type DuelConfig, type DuelPlayer } from "@/hooks/usePeerDuel";
import { listPublicRooms, type PublicRoom } from "@/lib/duel-rooms";
import { cn } from "@/lib/utils";
import type { Snippet, SnippetLength, TestMode, TimedDuration } from "@/types";

const LENGTHS: SnippetLength[] = ["short", "medium", "long"];
const DURATIONS: TimedDuration[] = [15, 30, 60];
export const ROOM_SIZES = [2, 3, 4, 6];

export const segment = (active: boolean) =>
  cn(
    "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer",
    active ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:text-foreground"
  );

const box = "flex rounded-xl border border-border/60 bg-background/60 p-0.5";

/** Player colors: you are always amber; everyone else gets a stable color by seat. */
const SEAT_COLORS = ["bg-sky-400", "bg-emerald-400", "bg-violet-400", "bg-rose-400", "bg-lime-400"];
const SEAT_TINTS = ["bg-sky-400/25", "bg-emerald-400/25", "bg-violet-400/25", "bg-rose-400/25", "bg-lime-400/25"];

export function seatTone(players: DuelPlayer[], id: string, selfId: string) {
  if (id === selfId) return { solid: "bg-amber-500", tint: "bg-amber-500/25" };
  const others = players.filter((player) => player.id !== selfId);
  const index = Math.max(0, others.findIndex((player) => player.id === id)) % SEAT_COLORS.length;
  return { solid: SEAT_COLORS[index], tint: SEAT_TINTS[index] };
}

export function Avatar({ name, solid, size = "md" }: { name: string; solid: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-black text-zinc-950", solid, size === "md" ? "size-12 text-lg" : "size-7 text-xs")}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Rules everyone races under. The host edits them; guests see the summary. */
export function MatchRules({ config, snippet, onChange, onShuffle, onCustom, languages, unavailableLengths }: {
  config: DuelConfig;
  snippet: Snippet;
  onChange: (next: DuelConfig) => void;
  onShuffle?: () => void;
  onCustom: (snippet: Snippet) => void;
  languages: string[];
  unavailableLengths: Set<SnippetLength>;
}) {
  const { mode, snippetLength, durationSeconds, selectedLanguage, maxPlayers, codeSource } = config;
  const custom = codeSource === "custom";
  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-[auto_1fr]">
        <div className={box}>
          {(["snippet", "timed"] as TestMode[]).map((value) => (
            <button key={value} type="button" onClick={() => onChange({ ...config, mode: value })} className={segment(mode === value)}>
              {value === "timed" ? <Timer className="size-3.5" /> : <Zap className="size-3.5" />}
              {value === "timed" ? "Timed" : "Snippet"}
            </button>
          ))}
        </div>
        <div className={box} role="group" aria-label="Room size">
          <span className="flex items-center gap-1 px-2 text-[11px] font-semibold text-muted-foreground"><Users className="size-3.5" /> Players</span>
          {ROOM_SIZES.map((size) => (
            <button key={size} type="button" onClick={() => onChange({ ...config, maxPlayers: size })} className={segment(maxPlayers === size)}>
              {size === 2 ? "1v1" : size}
            </button>
          ))}
        </div>
      </div>

      {custom ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <FileCode2 className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">Custom code · {snippet.filename || "snippet"}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{snippet.language} · {snippet.code.length} chars</p>
          </div>
          {mode === "timed" && <span className="text-[11px] text-muted-foreground">{durationSeconds}s clock</span>}
          <button
            type="button"
            onClick={() => onChange({ ...config, codeSource: "random" })}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2.5 text-xs font-semibold hover:bg-muted cursor-pointer"
          >
            <Shuffle className="size-3.5" /> Use random code
          </button>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
          <select
            value={selectedLanguage}
            onChange={(event) => onChange({ ...config, selectedLanguage: event.target.value })}
            aria-label="Language"
            className="h-9 min-w-0 rounded-xl border border-border/60 bg-background/60 px-3 font-mono text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
          >
            {languages.map((language) => (
              <option key={language}>{language}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <div className={cn(box, "flex-1")}>
              {mode === "snippet"
                ? LENGTHS.map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => onChange({ ...config, snippetLength: len })}
                      title={unavailableLengths.has(len) ? `Not enough ${selectedLanguage} snippets for a full ${len} run` : undefined}
                      className={segment(snippetLength === len)}
                    >
                      {len}
                      {unavailableLengths.has(len) && <span className="text-amber-500">*</span>}
                    </button>
                  ))
                : DURATIONS.map((dur) => (
                    <button key={dur} type="button" onClick={() => onChange({ ...config, durationSeconds: dur })} className={segment(durationSeconds === dur)}>
                      {dur}s
                    </button>
                  ))}
            </div>
            {onShuffle && (
              <button
                type="button"
                onClick={onShuffle}
                title="Pick another snippet"
                aria-label="Pick another snippet"
                className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              >
                <Shuffle className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "timed" && custom && <p className="text-[11px] text-muted-foreground">Timed races stop at the clock or at the end of the code, whichever comes first.</p>}

      <CustomPractice
        onLoad={onCustom}
        maxChars={MAX_CUSTOM_CHARS}
        triggerLabel={custom ? "Change custom code" : "Use my own code"}
        submitLabel="Use this code"
        triggerClassName="h-8 w-full gap-1.5 rounded-xl border border-dashed text-xs font-semibold"
      />
    </div>
  );
}

export function VisibilityToggle({ isPublic, onChange, canPublish }: { isPublic: boolean; onChange: (next: boolean) => void; canPublish: boolean }) {
  return (
    <div className="space-y-1">
      <div className={box} role="group" aria-label="Room visibility">
        <button type="button" onClick={() => onChange(false)} className={segment(!isPublic)}>
          <Lock className="size-3.5" /> Private link
        </button>
        <button
          type="button"
          onClick={() => canPublish && onChange(true)}
          disabled={!canPublish}
          title={canPublish ? "List the room so anyone can join" : "Sign in with GitHub to host a public room"}
          className={cn(segment(isPublic), "disabled:cursor-not-allowed disabled:opacity-50")}
        >
          <Globe2 className="size-3.5" /> Public
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {isPublic ? "Listed in Open rooms. Anyone can join until the room is full." : canPublish ? "Only people with the link or code can join." : "Sign in with GitHub to list a room publicly."}
      </p>
    </div>
  );
}

/** A lobby seat: a player, or an open seat inviting someone in. */
export function Seat({ player, solid, label, onKick, onInvite, inviteCopied }: {
  player?: DuelPlayer;
  solid: string;
  label?: string;
  onKick?: () => void;
  onInvite?: () => void;
  inviteCopied?: boolean;
}) {
  if (!player) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 p-3 text-center">
        <span className="grid size-12 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </span>
        <p className="text-xs font-semibold">Open seat</p>
        {onInvite && (
          <button type="button" onClick={onInvite} className="flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1 text-[11px] font-semibold hover:bg-muted cursor-pointer">
            {inviteCopied ? <Check className="size-3" /> : <Link2 className="size-3" />}
            {inviteCopied ? "Copied" : "Copy invite"}
          </button>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "group relative flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-colors",
        player.ready ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/60 bg-background/40"
      )}
    >
      {onKick && (
        <button
          type="button"
          onClick={onKick}
          title={`Remove ${player.name}`}
          aria-label={`Remove ${player.name}`}
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-muted-foreground opacity-70 transition hover:bg-rose-500/10 hover:text-rose-500 hover:opacity-100 cursor-pointer"
        >
          <UserX className="size-3.5" />
        </button>
      )}
      <div className="relative">
        <Avatar name={player.name} solid={solid} />
        {player.ready && (
          <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-card">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
        {player.isHost && (
          <span className="absolute -left-1 -top-1 grid size-5 place-items-center rounded-full bg-card text-amber-500 ring-1 ring-border" title="Host">
            <Crown className="size-3" />
          </span>
        )}
      </div>
      <div className="min-w-0 max-w-full">
        <p className="truncate text-sm font-bold">{player.name}</p>
        {label && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>}
      </div>
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
          player.spectating ? "bg-muted text-muted-foreground" : player.ready ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
        )}
      >
        {player.spectating ? <><Eye className="size-3" /> Next race</> : player.ready ? "Ready" : "Not ready"}
      </span>
    </div>
  );
}

export function RaceLane({ name, solid, tint, percent, wpm, accuracy, done, place }: {
  name: string;
  solid: string;
  tint: string;
  percent: number;
  wpm: number;
  accuracy: number;
  done: boolean;
  place?: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,8rem)_1fr_auto]">
      <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
        <Avatar name={name} solid={solid} size="sm" />
        <span className="truncate text-xs font-bold">{name}</span>
      </div>
      <div className="relative h-7 rounded-full bg-muted">
        <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-200", tint)} style={{ width: `${percent}%` }} />
        <span
          className={cn("absolute top-1/2 grid size-6 place-items-center rounded-full text-[10px] font-black text-zinc-950 shadow-md transition-[left] duration-200", solid)}
          style={{ left: `calc(${percent}% - ${percent / 100} * 1.5rem)`, translate: "0 -50%" }}
        >
          {done ? (place ? `${place}` : <Check className="size-3.5" strokeWidth={3} />) : name.trim().charAt(0).toUpperCase()}
        </span>
        <Flag className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
      </div>
      <div className="text-right font-mono text-xs leading-tight tabular-nums sm:w-36">
        <span className="text-sm font-black">{wpm.toFixed(0)}</span> <span className="text-muted-foreground">wpm</span>
        <span className="block text-[10px] text-muted-foreground sm:ml-2 sm:inline sm:text-xs">{accuracy}% acc</span>
      </div>
    </div>
  );
}

export function ordinal(place: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const rest = place % 100;
  return `${place}${suffixes[(rest - 20) % 10] ?? suffixes[rest] ?? suffixes[0]}`;
}

/** Refreshing list of public rooms, with Quick match. */
export function OpenRooms({ onJoin, onQuickMatch, busy, children }: {
  onJoin: (code: string) => void;
  onQuickMatch: (rooms: PublicRoom[]) => void;
  busy: boolean;
  children?: ReactNode;
}) {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRooms(await listPublicRooms());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Open rooms could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const joinable = (rooms ?? []).filter((room) => room.status === "lobby" && room.players < room.maxPlayers);

  return (
    <section className="overflow-hidden rounded-2xl border bg-card/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <Globe2 className="size-4 text-emerald-500" /> Open rooms
            {rooms && <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{joinable.length}</span>}
          </h2>
          <p className="text-xs text-muted-foreground">Public rooms waiting for players. Join one, or let Quick match pick.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh open rooms"
            className="grid size-9 place-items-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => onQuickMatch(joinable)}
            disabled={busy}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-black text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-60 cursor-pointer"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />} Quick match
          </button>
        </div>
      </div>

      {children}

      {error ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{error}</p>
      ) : !rooms ? (
        <div className="space-y-2 p-4">
          {[0, 1].map((key) => <div key={key} className="h-12 animate-pulse rounded-xl bg-muted/60" />)}
        </div>
      ) : rooms.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No open rooms right now. Host one and make it public, or hit Quick match.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {rooms.map((room) => {
            const full = room.players >= room.maxPlayers;
            const racing = room.status === "racing";
            return (
              <li key={room.code} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5">
                <Avatar name={room.hostName} solid="bg-sky-400" size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{room.hostName}'s room</p>
                  <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
                    <span>{room.language}</span>
                    <span>{room.mode === "timed" ? `${room.detail} timed` : room.custom ? room.detail : `${room.detail} snippet`}</span>
                    {room.custom && <span className="rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-300">custom code</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
                    <Users className="size-3.5" /> {room.players}/{room.maxPlayers}
                  </span>
                  <button
                    type="button"
                    onClick={() => onJoin(room.code)}
                    disabled={full || racing || busy}
                    className="h-8 min-w-16 rounded-lg bg-foreground px-3 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground cursor-pointer disabled:cursor-not-allowed"
                  >
                    {racing ? "Racing" : full ? "Full" : "Join"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
