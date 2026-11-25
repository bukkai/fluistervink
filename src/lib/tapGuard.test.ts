import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAP_PAUSE_MS, tapGuard } from './tapGuard';

afterEach(() => vi.useRealTimers());

describe('tapGuard', () => {
  it('negeert een tweede tik vlak na de eerste, ook op een andere knop', () => {
    vi.useFakeTimers();
    const once = tapGuard();
    const confirm = vi.fn();
    const discard = vi.fn();
    once(confirm)();
    vi.advanceTimersByTime(150);
    once(confirm)();
    once(discard)();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(discard).not.toHaveBeenCalled();

    vi.advanceTimersByTime(TAP_PAUSE_MS);
    once(discard)();
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it('geeft argumenten door', () => {
    const handler = vi.fn();
    tapGuard()(handler)('a', 2);
    expect(handler).toHaveBeenCalledWith('a', 2);
  });
});
