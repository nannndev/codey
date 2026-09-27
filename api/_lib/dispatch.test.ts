import { describe, expect, it, vi } from 'vitest';
import { dispatch, routeAction } from './dispatch';

describe('routeAction', () => {
  it('reads the rewritten query first', () => {
    expect(routeAction({ url: '/api/daily?action=start', query: { action: 'start' } }, 'daily')).toBe('start');
  });
  it('falls back to the path', () => {
    expect(routeAction({ url: '/api/ranked/submit?x=1' }, 'ranked')).toBe('submit');
    expect(routeAction({ url: '/api/daily?userId=u1', query: { userId: 'u1' } }, 'daily')).toBe('');
  });
});

describe('dispatch', () => {
  it('runs the matching route and 404s the rest', async () => {
    const start = vi.fn();
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) };
    const handler = dispatch('ranked', { start });
    await handler({ url: '/api/ranked/start' }, res);
    expect(start).toHaveBeenCalledOnce();
    await handler({ url: '/api/ranked/nope' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
