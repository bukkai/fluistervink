import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Nagebootste Wake Lock: de browser laat het slot los als de app uit beeld gaat
class FakeSentinel {
  released = false;
  release = vi.fn(async () => {
    this.released = true;
  });
}

let sentinels: FakeSentinel[];
let refuse: boolean;
let hidden: boolean;

async function load() {
  vi.resetModules();
  return import('./screenWakeLock');
}

function setHidden(value: boolean) {
  hidden = value;
  // Uit beeld: de browser laat het slot zelf los
  if (value) sentinels.forEach((sentinel) => (sentinel.released = true));
  document.dispatchEvent(new Event('visibilitychange'));
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  sentinels = [];
  refuse = false;
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: vi.fn(async () => {
        if (refuse) throw new Error('accu bijna leeg');
        const sentinel = new FakeSentinel();
        sentinels.push(sentinel);
        return sentinel;
      }),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { wakeLock?: unknown }).wakeLock;
});

describe('holdScreenOn', () => {
  it('houdt het scherm aan en laat los bij het stoppen', async () => {
    const { holdScreenOn } = await load();
    const stop = holdScreenOn(() => {});
    await flush();
    expect(sentinels).toHaveLength(1);
    stop();
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it('vraagt het opnieuw na terugkomen in beeld, niet als het slot er nog is', async () => {
    const { holdScreenOn } = await load();
    const stop = holdScreenOn(() => {});
    await flush();
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(sentinels).toHaveLength(1);

    setHidden(true);
    await flush();
    expect(sentinels).toHaveLength(1);
    setHidden(false);
    await flush();
    expect(sentinels).toHaveLength(2);
    stop();
  });

  it('na het stoppen niet meer opnieuw, ook niet als het verzoek nog liep', async () => {
    const { holdScreenOn } = await load();
    const stop = holdScreenOn(() => {});
    stop();
    await flush();
    expect(sentinels[0].release).toHaveBeenCalled();
    setHidden(true);
    setHidden(false);
    await flush();
    expect(sentinels).toHaveLength(1);
  });

  it('logt een weigering zonder te gooien', async () => {
    refuse = true;
    const { holdScreenOn } = await load();
    const log = vi.fn();
    const stop = holdScreenOn(log);
    await flush();
    expect(log).toHaveBeenCalledWith('wake_lock_error', {
      message: 'accu bijna leeg',
      via: 'schermAan',
    });
    stop();
  });

  it('doet niets in een browser zonder Wake Lock', async () => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    const { holdScreenOn, wakeLockSupported } = await load();
    expect(wakeLockSupported).toBe(false);
    expect(() => holdScreenOn(() => {})()).not.toThrow();
  });
});
