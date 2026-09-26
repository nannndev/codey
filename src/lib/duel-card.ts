/** A duel's result as a 1200×630 image, in the same split style as the other cards. */

export interface DuelCardRacer {
  name: string;
  wpm: number;
  accuracy: number;
  you: boolean;
}

export interface DuelCardInput {
  /** 1-based; 0 for a spectator. */
  place: number;
  outcome: "victory" | "defeat" | "draw" | null;
  racers: DuelCardRacer[];
  language: string;
  format: string;
  /** e.g. "3.2s ahead of Ada". */
  margin: string;
}

const AMBER = "#f59e0b";
const DEEP = "#78350f";
const COAL = "#18181b";
const DARK = "#0f1117";
const INK = "#f4f4f5";
const MUTED = "#a1a1aa";
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const ordinalOf = (place: number) => {
  const mod100 = place % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[place % 10] ?? "th";
  return `${place}${suffix}`;
};

export function duelHeadline(input: Pick<DuelCardInput, "place" | "outcome" | "racers">) {
  if (input.outcome === "draw") return { big: "Draw", small: "neck and neck" };
  if (input.racers.length <= 2) return input.outcome === "victory" ? { big: "Win", small: "1 vs 1 duel" } : { big: "2nd", small: "1 vs 1 duel" };
  return { big: ordinalOf(input.place), small: `of ${input.racers.length} racers` };
}

export function duelShareText(input: DuelCardInput) {
  const me = input.racers.find((racer) => racer.you);
  const speed = me ? ` at ${me.wpm.toFixed(1)} WPM` : "";
  const rivals = input.racers.filter((racer) => !racer.you).map((racer) => racer.name);
  const against = rivals.length === 1 ? rivals[0] : `${rivals.length} racers`;
  if (input.outcome === "victory") return `Won a Codey duel against ${against}${speed}. Who's next?`;
  if (input.outcome === "draw") return `Tied a Codey duel with ${against}${speed}. Rematch?`;
  return `Finished ${ordinalOf(input.place)} in a Codey duel against ${against}${speed}. Rematch?`;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function fit(context: CanvasRenderingContext2D, text: string, width: number) {
  if (context.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}...`).width > width) cut = cut.slice(0, -1);
  return `${cut}...`;
}

export async function createDuelCard(input: DuelCardInput, host = window.location.host): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const headline = duelHeadline(input);

  context.fillStyle = DARK;
  context.fillRect(0, 0, 1200, 630);
  context.fillStyle = AMBER;
  context.fillRect(0, 0, 470, 630);

  context.fillStyle = DEEP;
  context.font = `600 22px ${FONT}`;
  context.fillText("CODEY DUEL", 52, 84);
  context.font = `400 26px ${FONT}`;
  context.fillText(fit(context, `${input.language} · ${input.format}`, 370), 52, 120);
  context.fillStyle = COAL;
  context.font = `500 ${headline.big.length > 4 ? 140 : 190}px ${FONT}`;
  context.fillText(headline.big, 44, 360);
  context.fillStyle = DEEP;
  context.font = `400 36px ${FONT}`;
  context.fillText(headline.small, 52, 412);
  if (input.margin) {
    context.font = `600 22px ${FONT}`;
    const label = fit(context, input.margin, 340);
    const width = context.measureText(label).width + 36;
    context.fillStyle = COAL;
    roundRect(context, 52, 440, width, 46, 23);
    context.fillStyle = AMBER;
    context.fillText(label, 70, 470);
  }
  context.fillStyle = COAL;
  roundRect(context, 52, 530, 44, 44, 12);
  context.fillStyle = AMBER;
  context.font = `600 20px ${FONT}`;
  context.fillText("</>", 58, 559);
  context.fillStyle = COAL;
  context.font = `500 28px ${FONT}`;
  context.fillText("Codey", 110, 562);

  context.fillStyle = MUTED;
  context.font = `500 18px ${FONT}`;
  context.fillText("FINAL STANDINGS", 526, 84);
  context.textAlign = "right";
  context.font = `400 22px ${FONT}`;
  context.fillText(host, 1144, 84);
  context.textAlign = "left";

  const rows = input.racers.slice(0, 6);
  const rowHeight = Math.min(72, 420 / Math.max(1, rows.length));
  rows.forEach((racer, index) => {
    const y = 120 + index * rowHeight;
    if (racer.you) {
      context.fillStyle = "rgba(245,158,11,0.14)";
      roundRect(context, 514, y, 632, rowHeight - 10, 14);
    }
    context.fillStyle = index === 0 ? AMBER : MUTED;
    context.font = `700 28px ${FONT}`;
    context.fillText(String(index + 1), 534, y + (rowHeight - 10) / 2 + 10);
    context.fillStyle = INK;
    context.font = `500 28px ${FONT}`;
    context.fillText(fit(context, racer.you ? `${racer.name} (you)` : racer.name, 250), 578, y + (rowHeight - 10) / 2 + 10);
    const mid = y + (rowHeight - 10) / 2 + 10;
    context.textAlign = "right";
    context.fillStyle = MUTED;
    context.font = `400 20px ${FONT}`;
    context.fillText(`${racer.accuracy.toFixed(1)}% acc`, 1124, mid);
    const accWidth = context.measureText(`${racer.accuracy.toFixed(1)}% acc`).width;
    context.fillText("wpm", 1124 - accWidth - 24, mid);
    const wpmLabel = context.measureText("wpm").width;
    context.fillStyle = INK;
    context.font = `600 28px ${FONT}`;
    context.fillText(`${racer.wpm.toFixed(1)}`, 1124 - accWidth - 24 - wpmLabel - 8, mid);
    context.textAlign = "left";
  });
  if (input.racers.length > rows.length) {
    context.fillStyle = MUTED;
    context.font = `400 20px ${FONT}`;
    context.fillText(`+ ${input.racers.length - rows.length} more`, 578, 580);
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the duel card"))), "image/png"));
}
