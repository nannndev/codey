import { describe, expect, it } from "vitest";
import { itemsUnlockedBy, isUnlocked, sanitizeLook, toggleItem, unlockHint, WARDROBE } from "./kap-wardrobe";

const item = (id: string) => WARDROBE.find((candidate) => candidate.id === id)!;

describe("kap wardrobe", () => {
  it("unlocks items by achievement, amber is free", () => {
    expect(isUnlocked(item("amber"), new Set())).toBe(true);
    expect(isUnlocked(item("shades"), new Set())).toBe(false);
    expect(isUnlocked(item("shades"), new Set(["speed-3"]))).toBe(true);
  });

  it("every requirement is a real achievement with a goal", () => {
    for (const entry of WARDROBE) if (entry.requires) expect(unlockHint(entry)).not.toBe("Keep practicing");
    expect(unlockHint(item("shades"))).toBe("Hit 100 WPM on code");
  });

  it("drops unknown and locked items from a stored look", () => {
    const look = sanitizeLook({ color: "ocean", head: "halo", eyes: "laser", wear: "cape" }, new Set(["streak-2", "speed-4"]));
    expect(look).toEqual({ color: "ocean", wear: "cape" });
    expect(sanitizeLook("junk", new Set())).toEqual({});
  });

  it("toggles accessories but always keeps a colour", () => {
    const on = toggleItem({}, item("party"));
    expect(on.head).toBe("party");
    expect(toggleItem(on, item("party")).head).toBeNull();
    expect(toggleItem({ color: "ocean" }, item("ocean")).color).toBe("ocean");
  });

  it("names what a badge unlocks", () => {
    expect(itemsUnlockedBy("streak-4").map((entry) => entry.name)).toEqual(["Headband"]);
  });
});
