import type { WeeklyRecap } from "./weekly-recap";

/** The weekly recap as a 1200×630 image, in the same split style as the link cards. */

const AMBER = "#f59e0b";
const DEEP = "#78350f";
const COAL = "#18181b";
const DARK = "#0f1117";
const INK = "#f4f4f5";
const MUTED = "#a1a1aa";
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

const range = (start: number) => {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${format.format(start)} - ${format.format(end)}`;
};

export async function createRecapCard(recap: WeeklyRecap, player: { name?: string; username?: string | null }, host = window.location.host): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const { thisWeek } = recap;

  context.fillStyle = DARK;
  context.fillRect(0, 0, 1200, 630);
  context.fillStyle = AMBER;
  context.fillRect(0, 0, 470, 630);

  // Amber side: the week's average speed and the change.
  context.textBaseline = "alphabetic";
  context.fillStyle = DEEP;
  context.font = `600 22px ${FONT}`;
  context.fillText("WEEKLY RECAP", 52, 84);
  context.font = `400 26px ${FONT}`;
  context.fillText(range(recap.weekStart), 52, 120);
  context.fillStyle = COAL;
  const wpm = thisWeek.runs ? (Number.isInteger(Math.round(thisWeek.avgWpm * 10) / 10) ? String(Math.round(thisWeek.avgWpm)) : thisWeek.avgWpm.toFixed(1)) : "-";
  context.font = `500 ${wpm.length > 4 ? 128 : wpm.length > 3 ? 150 : 190}px ${FONT}`;
  context.fillText(wpm, 44, 360);
  context.fillStyle = DEEP;
  context.font = `400 36px ${FONT}`;
  context.fillText("avg wpm this week", 52, 412);
  if (recap.wpmDelta !== null) {
    const up = recap.wpmDelta >= 0;
    const label = `${up ? "+" : ""}${recap.wpmDelta.toFixed(1)} vs last week`;
    context.font = `600 24px ${FONT}`;
    const width = context.measureText(label).width + 36;
    context.fillStyle = COAL;
    roundRect(context, 52, 440, width, 46, 23);
    context.fillStyle = up ? "#4ade80" : "#fb7185";
    context.fillText(label, 70, 471);
  }
  context.fillStyle = COAL;
  roundRect(context, 52, 530, 44, 44, 12);
  context.fillStyle = AMBER;
  context.font = `600 20px ${FONT}`;
  context.fillText("</>", 58, 559);
  context.fillStyle = COAL;
  context.font = `500 28px ${FONT}`;
  context.fillText("Codey", 110, 562);

  // Dark side: who, the days, the numbers.
  context.fillStyle = INK;
  context.font = `500 30px ${FONT}`;
  context.fillText(player.name || "My week", 526, 90);
  context.fillStyle = MUTED;
  context.font = `400 22px ${FONT}`;
  context.fillText(player.username ? `@${player.username}` : "on Codey", 526, 122);
  context.textAlign = "right";
  context.fillText(host, 1144, 90);
  context.textAlign = "left";

  context.fillStyle = MUTED;
  context.font = `500 18px ${FONT}`;
  context.fillText(`PRACTICED ${thisWeek.days} OF 7 DAYS`, 526, 196);
  const most = Math.max(1, ...thisWeek.perDay);
  const barWidth = 68;
  thisWeek.perDay.forEach((count, index) => {
    const x = 526 + index * (barWidth + 20);
    const height = count ? 40 + (count / most) * 150 : 10;
    context.fillStyle = count ? AMBER : "rgba(255,255,255,0.08)";
    roundRect(context, x, 400 - height, barWidth, height, 10);
    context.fillStyle = count ? INK : MUTED;
    context.font = `500 18px ${FONT}`;
    context.textAlign = "center";
    context.fillText(DAYS[index], x + barWidth / 2, 430);
    if (count) {
      context.fillStyle = COAL;
      context.font = `600 18px ${FONT}`;
      context.fillText(String(count), x + barWidth / 2, 400 - height + 26);
    }
    context.textAlign = "left";
  });

  const stats: [string, string][] = [
    ["RUNS", String(thisWeek.runs)],
    ["TIME", thisWeek.minutes >= 60 ? `${(thisWeek.minutes / 60).toFixed(1)}h` : `${Math.round(thisWeek.minutes)}m`],
    ["BEST", thisWeek.runs ? `${thisWeek.bestWpm.toFixed(0)} wpm` : "-"],
    ["ACCURACY", thisWeek.runs ? `${thisWeek.avgAccuracy.toFixed(1)}%` : "-"],
  ];
  stats.forEach(([label, value], index) => {
    const x = 526 + index * 158;
    context.fillStyle = MUTED;
    context.font = `500 18px ${FONT}`;
    context.fillText(label, x, 520);
    context.fillStyle = INK;
    context.font = `500 34px ${FONT}`;
    context.fillText(value, x, 562);
  });

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the recap"))), "image/png"));
}
