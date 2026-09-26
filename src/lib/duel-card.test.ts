import { describe, expect, it } from "vitest";
import { duelHeadline, duelShareText, ordinalOf, type DuelCardInput } from "./duel-card";

const racers = [
  { name: "Ada", wpm: 91.2, accuracy: 98, you: true },
  { name: "Linus", wpm: 84.5, accuracy: 95, you: false },
];

describe("duel card", () => {
  it("names places", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinalOf)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("headlines one-on-one and party races", () => {
    expect(duelHeadline({ place: 1, outcome: "victory", racers })).toEqual({ big: "Win", small: "1 vs 1 duel" });
    const party = [...racers, { name: "Grace", wpm: 70, accuracy: 90, you: false }];
    expect(duelHeadline({ place: 2, outcome: "defeat", racers: party })).toEqual({ big: "2nd", small: "of 3 racers" });
    expect(duelHeadline({ place: 1, outcome: "draw", racers }).big).toBe("Draw");
  });

  it("writes the post", () => {
    const input: DuelCardInput = { place: 1, outcome: "victory", racers, language: "Go", format: "Snippet", margin: "" };
    expect(duelShareText(input)).toBe("Won a Codey duel against Linus at 91.2 WPM. Who's next?");
    expect(duelShareText({ ...input, outcome: "defeat", place: 2 })).toBe("Finished 2nd in a Codey duel against Linus at 91.2 WPM. Rematch?");
  });
});
