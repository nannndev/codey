import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Vercel's Hobby plan deploys at most 12 functions; every .ts under api/
// outside _-prefixed folders counts, tests included, and one more fails the deploy.
const HOBBY_LIMIT = 12;
const API_ROOT = join(__dirname, "..");

function functionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name.startsWith("_") || name.startsWith(".")) return [];
    if (statSync(path).isDirectory()) return functionFiles(path);
    return /\.(ts|js|mjs)$/.test(name) && !name.endsWith(".d.ts") ? [relative(API_ROOT, path)] : [];
  });
}

describe("api functions", () => {
  it("stay within the Vercel Hobby limit", () => {
    expect(functionFiles(API_ROOT).length).toBeLessThanOrEqual(HOBBY_LIMIT);
  });

  it("do not include tests (they would deploy as functions)", () => {
    expect(functionFiles(API_ROOT).filter((file) => file.includes(".test."))).toEqual([]);
  });
});
