import { getStreak } from "@/utils/storage";
import { FLAME_TIERS, tierFor } from "@/utils/flame-tiers";
import { kapSvg } from "@/utils/kap-art";
import { readLook } from "@/lib/kap-wardrobe";

/**
 * Draws the player's Kap (their Wardrobe look and current flame) onto a
 * share card, on a soft tile. Resolves quietly if the image cannot load, so
 * a card never fails over the mascot.
 */
export async function drawPlayerKap(context: CanvasRenderingContext2D, x: number, y: number, tile: number) {
  const tier = tierFor(getStreak().current) ?? FLAME_TIERS[1];
  const width = Math.round(tile * 0.85);
  const height = Math.round(width * 258 / 240);
  const url = URL.createObjectURL(new Blob([kapSvg(tier, readLook(), width * 2)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    context.fillStyle = "rgba(120,53,15,0.16)";
    context.beginPath();
    context.roundRect(x, y, tile, tile, tile / 4);
    context.fill();
    context.drawImage(image, x + (tile - width) / 2, y + (tile - height) / 2 + 2, width, height);
  } catch {
    // No Kap on this card.
  } finally {
    URL.revokeObjectURL(url);
  }
}
