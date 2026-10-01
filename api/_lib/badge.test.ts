import { describe, expect, it } from 'vitest';
import { renderBadge, textWidth } from './badge';
import { FLAME_TIERS } from '../../src/utils/flame-tiers';
import type { SharedProfile } from './profile-card';

const profile = { userId: 'u', name: 'Nan <script>', username: 'nannndev', avatarUrl: null, runs: 212, bestWpm: 112.4, bestLanguage: 'C++ & Rust', avgWpm: 90, avgAccuracy: 97, bestStreak: 31, topLanguage: 'TypeScript', division: { name: 'Gold II', color: '#ffd700' }, trend: [], badges: { earned: 3, top: [] } } as SharedProfile;

describe('README badges', () => {
  it('draws the card with speed, division and Kap, escaping text', () => {
    const svg = renderBadge({ profile, kap: { tier: FLAME_TIERS[2], look: { eyes: 'shades' } } });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="440" height="120"')).toBe(true);
    expect(svg).toContain('>112.4<');
    expect(svg).toContain('Gold II');
    expect(svg).toContain('best in C++ &amp; Rust · 212 runs · 31-day streak');
    expect(svg).toContain('Nan &lt;script&gt; on Codey');
    expect(svg).not.toContain('<script');
    // Kap nested inline, so no outside requests.
    expect(svg).toContain('<svg x="17" y="13"');
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });

  it('has a shields-sized flat style and a placeholder for new players', () => {
    const flat = renderBadge({ profile, style: 'flat' });
    expect(flat).toContain('height="20"');
    expect(flat).toContain('112.4 WPM · Gold II');
    expect(renderBadge({ profile: null })).toContain('Typing real code');
    expect(renderBadge({ profile: null, style: 'flat' })).toContain('typing real code');
  });

  it('estimates wider text for longer strings', () => {
    expect(textWidth('112.4 WPM · Platinum III', 11)).toBeGreaterThan(textWidth('98 WPM', 11));
  });
});
