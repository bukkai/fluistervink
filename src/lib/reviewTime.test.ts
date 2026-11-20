import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import {
  IDLE_CAP_MS,
  ReviewClock,
  addReviewTime,
  reviewMinutes,
  trackReviewTime,
} from './reviewTime';

const MIN = 60_000;

describe('nalooptijd', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('telt de tijd tussen aanrakingen, een lang gat hooguit tot de grens', () => {
    const clock = new ReviewClock();
    clock.activity(0);
    clock.activity(30_000);
    clock.activity(30_000 + 20 * MIN); // scherm laten liggen
    expect(clock.take()).toBe(30_000 + IDLE_CAP_MS);
    expect(clock.take()).toBe(0);
  });

  it('telt niet door terwijl het scherm uit beeld is', () => {
    const clock = new ReviewClock();
    clock.activity(0);
    clock.pause(MIN);
    clock.activity(60 * MIN); // weer in beeld: begint opnieuw
    clock.activity(61 * MIN);
    expect(clock.take()).toBe(2 * MIN);
  });

  it('telt op bij wat er al was', async () => {
    await db.sessions.add({ id: 'review', startedAt: 0, status: 'ended', reviewMs: MIN });
    await addReviewTime('review', 30_000);
    await addReviewTime('review', 0);
    expect((await db.sessions.get('review'))?.reviewMs).toBe(90_000);
  });

  it('schrijft weg bij stoppen', async () => {
    vi.useFakeTimers({ now: 0, toFake: ['Date'] });
    await db.sessions.add({ id: 'scherm', startedAt: 0, status: 'ended' });
    const stop = trackReviewTime('scherm');
    vi.setSystemTime(MIN);
    window.dispatchEvent(new Event('pointerdown'));
    vi.setSystemTime(MIN + 10_000);
    stop();
    await vi.waitFor(async () =>
      expect((await db.sessions.get('scherm'))?.reviewMs).toBe(MIN + 10_000),
    );
    // Na het stoppen telt een aanraking niet meer
    window.dispatchEvent(new Event('pointerdown'));
    expect((await db.sessions.get('scherm'))?.reviewMs).toBe(MIN + 10_000);
  });

  it('rondt af op hele minuten, onder een halve minuut 0', () => {
    expect(reviewMinutes(20_000)).toBe(0);
    expect(reviewMinutes(2.6 * MIN)).toBe(3);
  });
});
