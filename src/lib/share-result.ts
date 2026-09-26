import type { RunResult, Snippet } from "@/types";
import { KEYBOARD_ROWS, missedKeys } from "@/lib/keyboard-layout";
import { resolveKeyColors, type KeycapColorway, type KeycapOverrides } from "@/lib/keycaps";

export type ShareCardTheme = "dark" | "tokyo" | "catppuccin" | "dracula" | "light";

export interface ShareCardOptions {
  result: RunResult;
  username?: string;
  heading?: string;
  rank?: number;
  theme?: ShareCardTheme;
  /** The viewer's keycap colorway and per-key paint, drawn as a mini keyboard. */
  keycaps?: { colorway: KeycapColorway | null; overrides: KeycapOverrides };
  /** The exact snippet, when the run can be sent as a challenge. */
  challenge?: Snippet;
  /** Open on the challenge tab instead of the score. */
  startWithChallenge?: boolean;
}

const WIDTH = 1200;
const HEIGHT = 630;

interface ThemePalette {
  bgGradient: [string, string, string];
  cardBg: string;
  cardBorder: string;
  primaryText: string;
  secondaryText: string;
  accentText: string;
  accentGlow: string;
  lineColor: string;
  subCodeColor: string;
  badgeBg: string;
  badgeText: string;
}

export const SHARE_THEMES: Record<ShareCardTheme, { name: string; colors: ThemePalette }> = {
  dark: {
    name: "Dark Carbon",
    colors: {
      bgGradient: ["#18181b", "#0f0f11", "#09090b"],
      cardBg: "rgba(255, 255, 255, 0.045)",
      cardBorder: "#27272a",
      primaryText: "#f4f4f5",
      secondaryText: "#a1a1aa",
      accentText: "#a855f7",
      accentGlow: "rgba(168, 85, 247, 0.2)",
      lineColor: "#c084fc",
      subCodeColor: "#27272a",
      badgeBg: "rgba(168, 85, 247, 0.15)",
      badgeText: "#d8b4fe",
    },
  },
  tokyo: {
    name: "Tokyo Night",
    colors: {
      bgGradient: ["#1a1b26", "#16161e", "#101014"],
      cardBg: "rgba(122, 162, 247, 0.06)",
      cardBorder: "#2ac3de",
      primaryText: "#c0caf5",
      secondaryText: "#7aa2f7",
      accentText: "#7dcfff",
      accentGlow: "rgba(125, 207, 255, 0.25)",
      lineColor: "#7dcfff",
      subCodeColor: "#24283b",
      badgeBg: "rgba(125, 207, 255, 0.18)",
      badgeText: "#7dcfff",
    },
  },
  catppuccin: {
    name: "Catppuccin Mocha",
    colors: {
      bgGradient: ["#1e1e2e", "#181825", "#11111b"],
      cardBg: "rgba(203, 166, 247, 0.07)",
      cardBorder: "#45475a",
      primaryText: "#cdd6f4",
      secondaryText: "#bac2de",
      accentText: "#cba6f7",
      accentGlow: "rgba(203, 166, 247, 0.2)",
      lineColor: "#a6e3a1",
      subCodeColor: "#313244",
      badgeBg: "rgba(166, 227, 161, 0.15)",
      badgeText: "#a6e3a1",
    },
  },
  dracula: {
    name: "Dracula",
    colors: {
      bgGradient: ["#282a36", "#1e1f29", "#14151d"],
      cardBg: "rgba(189, 147, 249, 0.08)",
      cardBorder: "#6272a4",
      primaryText: "#f8f8f2",
      secondaryText: "#bd93f9",
      accentText: "#ff79c6",
      accentGlow: "rgba(255, 121, 198, 0.25)",
      lineColor: "#ff79c6",
      subCodeColor: "#44475a",
      badgeBg: "rgba(255, 121, 198, 0.15)",
      badgeText: "#ff79c6",
    },
  },
  light: {
    name: "Minimal Light",
    colors: {
      bgGradient: ["#ffffff", "#f4f4f5", "#e4e4e7"],
      cardBg: "rgba(0, 0, 0, 0.035)",
      cardBorder: "#d4d4d8",
      primaryText: "#09090b",
      secondaryText: "#71717a",
      accentText: "#7c3aed",
      accentGlow: "rgba(124, 58, 237, 0.12)",
      lineColor: "#7c3aed",
      subCodeColor: "#e4e4e7",
      badgeBg: "rgba(124, 58, 237, 0.1)",
      badgeText: "#7c3aed",
    },
  },
};

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function label(context: CanvasRenderingContext2D, text: string, x: number, y: number, color = "#777777") {
  context.fillStyle = color;
  context.font = "600 18px monospace";
  context.letterSpacing = "3px";
  context.fillText(text.toUpperCase(), x, y);
  context.letterSpacing = "0px";
}

function drawLogo(context: CanvasRenderingContext2D, primaryColor: string) {
  const x = 72;
  const y = 58;
  const size = 66;
  roundedRect(context, x, y, size, size, 18);
  context.fillStyle = primaryColor;
  context.fill();
  context.strokeStyle = "rgba(0,0,0,0.4)";
  context.lineWidth = 4;
  roundedRect(context, x + 12, y + 13, 42, 40, 9);
  context.stroke();
  context.beginPath();
  context.moveTo(x + 13, y + 25);
  context.lineTo(x + 53, y + 25);
  context.stroke();
  context.fillStyle = "#09090b";
  context.font = "800 20px monospace";
  context.fillText("CT", x + 19, y + 48);
}

function drawTrend(context: CanvasRenderingContext2D, values: number[], x: number, y: number, width: number, height: number, strokeColor: string) {
  if (values.length < 2) {
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y + height / 2);
    context.lineTo(x + width, y + height / 2);
    context.stroke();
    return;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 10);
  context.beginPath();
  values.forEach((value, index) => {
    const pointX = x + (index / (values.length - 1)) * width;
    const pointY = y + height - ((value - min) / range) * height;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  });
  context.strokeStyle = strokeColor;
  context.lineWidth = 5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
}

/**
 * Mini keyboard in the viewer's keycap colors with missed keys ringed red.
 * Keys without a colorway color fall back to the card palette.
 */
function drawKeyboard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: number,
  palette: ThemePalette,
  keycaps: ShareCardOptions["keycaps"],
  missed: Map<string, number>,
) {
  const gap = Math.round(unit * 0.12);
  const depth = Math.max(2, Math.round(unit * 0.14));
  const maxMissed = Math.max(1, ...missed.values());
  KEYBOARD_ROWS.forEach((row, rowIndex) => {
    let cursor = x;
    const top = y + rowIndex * (unit + gap + depth);
    for (const key of row) {
      const width = unit * (key.w ?? 1) + gap * ((key.w ?? 1) - 1);
      const colors = keycaps ? resolveKeyColors(key.id, keycaps.colorway, keycaps.overrides) : {};
      const cap = colors.cap ?? palette.subCodeColor;
      const legend = colors.legend ?? palette.secondaryText;
      const misses = missed.get(key.id) ?? 0;

      roundedRect(context, cursor, top + depth, width, unit, 6);
      context.fillStyle = "rgba(0, 0, 0, 0.45)";
      context.fill();
      roundedRect(context, cursor, top, width, unit, 6);
      context.fillStyle = cap;
      context.fill();
      context.strokeStyle = "rgba(0, 0, 0, 0.25)";
      context.lineWidth = 1;
      context.stroke();

      if (misses > 0) {
        context.save();
        context.shadowColor = "rgba(239, 68, 68, 0.9)";
        context.shadowBlur = 8 + (misses / maxMissed) * 14;
        roundedRect(context, cursor - 1, top - 1, width + 2, unit + 2, 7);
        context.strokeStyle = "#ef4444";
        context.lineWidth = 2.5;
        context.stroke();
        context.restore();
      }

      if (key.label) {
        context.fillStyle = legend;
        context.font = `700 ${Math.round(unit * (key.label.length > 1 ? 0.3 : 0.42))}px monospace`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(key.label, cursor + width / 2, top + unit / 2 + 1);
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
      }
      cursor += width + gap;
    }
  });
}

export async function createResultCard({ result, username, heading, rank, theme = "dark", keycaps }: ShareCardOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  const palette = SHARE_THEMES[theme]?.colors ?? SHARE_THEMES.dark.colors;

  const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, palette.bgGradient[0]);
  background.addColorStop(0.52, palette.bgGradient[1]);
  background.addColorStop(1, palette.bgGradient[2]);
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();
  context.globalAlpha = 0.04;
  context.fillStyle = palette.primaryText;
  context.font = "800 96px monospace";
  context.rotate(-0.08);
  context.fillText("{ }  </>  fn()  =>  const", -30, 245);
  context.fillText("async  []  ::  return  01", 100, 480);
  context.restore();

  drawLogo(context, palette.primaryText);
  context.fillStyle = palette.primaryText;
  context.font = "800 32px monospace";
  context.fillText("Codey_", 158, 98);
  context.fillStyle = palette.secondaryText;
  context.font = "500 18px monospace";
  context.textAlign = "right";
  context.fillText(username ? `@${username}` : "type real code, get faster", 1128, 98);
  context.textAlign = "left";

  if (rank && rank > 0) {
    // --- DEDICATED LEADERBOARD RANK CARD LAYOUT ---
    label(context, heading ?? `GLOBAL LEADERBOARD · ${result.language}`, 72, 168, palette.secondaryText);

    // Left Column: Big WPM
    context.fillStyle = palette.primaryText;
    context.font = "800 110px monospace";
    context.fillText(result.wpm.toFixed(1), 65, 290);
    context.fillStyle = palette.accentText;
    context.font = "700 28px monospace";
    context.fillText("WPM", 385, 280);

    // Speed Trace Box
    roundedRect(context, 72, 345, 680, 180, 24);
    context.fillStyle = palette.cardBg;
    context.fill();
    context.strokeStyle = palette.cardBorder;
    context.lineWidth = 2;
    context.stroke();
    label(context, "SPEED TRACE", 104, 385, palette.secondaryText);
    drawTrend(context, result.wpmSnapshots ?? [], 104, 415, 616, 85, palette.lineColor);

    // Right Column: PROMINENT RANK HIGHLIGHT BOX
    const rankBoxX = 790;
    const rankBoxY = 145;
    const rankBoxW = 338;
    const rankBoxH = 380;

    roundedRect(context, rankBoxX, rankBoxY, rankBoxW, rankBoxH, 28);

    const rankGradient = context.createLinearGradient(rankBoxX, rankBoxY, rankBoxX + rankBoxW, rankBoxY + rankBoxH);
    if (rank === 1) {
      rankGradient.addColorStop(0, "rgba(245, 158, 11, 0.25)");
      rankGradient.addColorStop(1, "rgba(180, 83, 9, 0.08)");
    } else if (rank === 2) {
      rankGradient.addColorStop(0, "rgba(148, 163, 184, 0.25)");
      rankGradient.addColorStop(1, "rgba(71, 85, 105, 0.08)");
    } else if (rank === 3) {
      rankGradient.addColorStop(0, "rgba(217, 119, 6, 0.25)");
      rankGradient.addColorStop(1, "rgba(120, 53, 15, 0.08)");
    } else {
      rankGradient.addColorStop(0, palette.accentGlow);
      rankGradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");
    }

    context.fillStyle = rankGradient;
    context.fill();
    context.strokeStyle = rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : rank === 3 ? "#d97706" : palette.cardBorder;
    context.lineWidth = rank <= 3 ? 3 : 2;
    context.stroke();

    // Rank Crown / Badge Pill
    const badgeLabel = rank === 1 ? "👑 RANK #1 GOLD" : rank === 2 ? "🥈 RANK #2 SILVER" : rank === 3 ? "🥉 RANK #3 BRONZE" : `⚡ RANK #${rank}`;
    const badgeBg = rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : rank === 3 ? "#d97706" : palette.badgeBg;
    const badgeText = rank <= 3 ? "#09090b" : palette.badgeText;

    roundedRect(context, rankBoxX + 24, rankBoxY + 24, 210, 36, 12);
    context.fillStyle = badgeBg;
    context.fill();
    context.fillStyle = badgeText;
    context.font = "800 13px monospace";
    context.fillText(badgeLabel, rankBoxX + 38, rankBoxY + 47);

    // Giant Rank Number Display
    context.fillStyle = rank === 1 ? "#fbbf24" : rank === 2 ? "#e2e8f0" : rank === 3 ? "#f59e0b" : palette.primaryText;
    context.font = "900 115px monospace";
    context.fillText(`#${rank}`, rankBoxX + 24, rankBoxY + 180);

    // Accuracy & Consistency Mini Stats inside Rank Card
    label(context, "ACCURACY", rankBoxX + 24, rankBoxY + 245, palette.secondaryText);
    context.fillStyle = palette.primaryText;
    context.font = "800 28px monospace";
    context.fillText(`${result.accuracy.toFixed(1)}%`, rankBoxX + 24, rankBoxY + 280);

    label(context, "CONSISTENCY", rankBoxX + 175, rankBoxY + 245, palette.secondaryText);
    context.fillStyle = palette.secondaryText;
    context.font = "700 24px monospace";
    context.fillText(`${result.consistency.toFixed(1)}%`, rankBoxX + 175, rankBoxY + 280);

    // Format info
    context.fillStyle = palette.secondaryText;
    context.font = "600 13px monospace";
    const modeDesc = result.mode === "timed" ? `${Math.round(result.duration / 1000)}s Timed` : `${result.snippetLength ?? ''} Snippet`;
    context.fillText(`${result.language} · ${modeDesc}`, rankBoxX + 24, rankBoxY + 335);

    // Footer
    context.fillStyle = palette.secondaryText;
    context.font = "500 15px monospace";
    context.fillText(`OFFICIAL CODEY LEADERBOARD RANK #${rank} · COMMUNITY RUN`, 72, 590);
    context.textAlign = "right";
    context.fillText(window.location.host, 1128, 590);

  } else {
    // --- STANDARD TYPING RESULT CARD LAYOUT ---
    const modeText = result.mode === "timed" ? `${Math.round(result.duration / 1000)}s timed` : result.mode === "snippet" && result.snippetLength ? `${result.snippetLength} snippet` : result.mode;
    label(context, heading ?? `${result.language} · ${modeText}`, 72, 178, palette.secondaryText);
    context.fillStyle = palette.primaryText;
    context.font = "800 128px monospace";
    context.fillText(result.wpm.toFixed(1), 65, 312);
    const wpmWidth = context.measureText(result.wpm.toFixed(1)).width;
    context.fillStyle = palette.accentText;
    context.font = "700 30px monospace";
    context.fillText("WPM", 65 + wpmWidth + 14, 304);

    // 2x2 stat tiles under the WPM
    const tiles = [
      ["Accuracy", `${result.accuracy.toFixed(1)}%`],
      ["Consistency", `${result.consistency.toFixed(1)}%`],
      ["Max streak", result.maxCombo === undefined ? "—" : String(result.maxCombo)],
      ["Raw speed", `${result.rawWpm.toFixed(1)}`],
    ];
    tiles.forEach(([name, value], index) => {
      const tileX = 72 + (index % 2) * 248;
      const tileY = 352 + Math.floor(index / 2) * 96;
      roundedRect(context, tileX, tileY, 232, 82, 18);
      context.fillStyle = palette.cardBg;
      context.fill();
      context.strokeStyle = palette.cardBorder;
      context.lineWidth = 2;
      context.stroke();
      label(context, name, tileX + 20, tileY + 32, palette.secondaryText);
      context.fillStyle = index === 0 ? palette.accentText : palette.primaryText;
      context.font = "800 28px monospace";
      context.fillText(value, tileX + 20, tileY + 66);
    });

    // Right card: speed trace on top, keycap keyboard below
    const panelX = 600;
    const panelY = 160;
    const panelW = 528;
    roundedRect(context, panelX, panelY, panelW, 378, 28);
    context.fillStyle = palette.cardBg;
    context.fill();
    context.strokeStyle = palette.cardBorder;
    context.lineWidth = 2;
    context.stroke();
    label(context, "Speed trace", panelX + 28, panelY + 44, palette.secondaryText);
    drawTrend(context, result.wpmSnapshots ?? [], panelX + 28, panelY + 62, panelW - 56, 58, palette.lineColor);

    const missed = new Map(missedKeys(result.errorPositions, 10).map(({ id, count }) => [id, count]));
    // Cloud runs don't store per-key errors, so "clean" only when we know it.
    const keyboardTitle = missed.size ? "Missed keys" : result.totalErrors === 0 ? "Clean run · no missed keys" : "Your keycaps";
    label(context, keyboardTitle, panelX + 28, panelY + 162, palette.secondaryText);
    const unit = 28;
    const keyboardWidth = unit * 15 + Math.round(unit * 0.12) * 14;
    drawKeyboard(context, panelX + (panelW - keyboardWidth) / 2, panelY + 180, unit, palette, keycaps, missed);

    context.fillStyle = palette.secondaryText;
    context.font = "500 15px monospace";
    const footer = result.sourceType === "custom" ? "LOCAL PRACTICE · NOT RANKED" : `${result.totalErrors} ERRORS · ${result.charsTyped} KEYSTROKES · COMMUNITY RUN`;
    context.fillText(footer, 72, 590);
    context.textAlign = "right";
    context.fillText(window.location.host, 1128, 590);
  }

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to generate image")), "image/png", 1));
}
