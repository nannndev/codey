import { describe, expect, it } from 'vitest';
import { lookFromPrefs, playerKap } from './kap-look';

describe('kap look on share cards', () => {
  it('reads the synced look, keeping only unlocked items', () => {
    const prefs = {
      sync: { slices: { kapLook: { at: 1, value: { color: 'ocean', eyes: 'shades', wear: 'cape' } } } },
      achievements: { unlockedAt: { 'streak-2': 1, 'speed-3': 1 } },
    };
    expect(lookFromPrefs(prefs)).toEqual({ color: 'ocean', eyes: 'shades' });
    expect(lookFromPrefs({})).toEqual({});
  });

  it('falls back to the plain Kap when prefs cannot be read', async () => {
    const uri = await playerKap('user1', 7, 200, async () => { throw new Error('offline'); });
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = Buffer.from(uri.split(',')[1], 'base64').toString();
    expect(svg).toContain('#fbbf24');
  });

  it('dresses Kap from the prefs', async () => {
    const uri = await playerKap('user1', 7, 200, async () => ({
      sync: { slices: { kapLook: { value: { color: 'sakura', head: 'party' } } } },
      achievements: { unlockedAt: { 'streak-3': 1, 'duel-1': 1 } },
    }));
    const svg = Buffer.from(uri.split(',')[1], 'base64').toString();
    expect(svg).toContain('#f9a8d4');
    expect(svg).toContain('#f472b6');
  });
});
