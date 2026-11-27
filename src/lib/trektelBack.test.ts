import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trektelBackGuard, type TrektelBackGuard } from './trektelBack';

/**
 * Een eenvoudige geschiedenis in plaats van die van happy-dom: `back` geeft,
 * net als de browser, pas later een `popstate`.
 */
function fakeHistory() {
  const entries: { url: string; state: unknown }[] = [{ url: 'https://x/app/#', state: null }];
  let index = 0;
  const go = (to: number) => {
    if (to < 0 || to >= entries.length) return;
    const fromUrl = entries[index].url;
    index = to;
    setUrl(entries[index].url);
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: entries[index].state }));
      if (fromUrl !== entries[index].url) window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  };
  const fake = {
    get state() {
      return entries[index].state;
    },
    get length() {
      return entries.length;
    },
    pushState(state: unknown, _title: string, url?: string) {
      entries.splice(index + 1);
      entries.push({ url: url ?? entries[index].url, state });
      index++;
      setUrl(entries[index].url);
    },
    back: () => go(index - 1),
  };
  let href = entries[0].url;
  const setUrl = (url: string) => (href = url);
  /** Een link of `location.hash = …`: nieuwe stap plus hashchange */
  const navigate = (hash: string) => {
    fake.pushState(null, '', `https://x/app/#${hash}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  return {
    fake,
    navigate,
    get href() {
      return href;
    },
    get index() {
      return index;
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('trektelBackGuard', () => {
  let h: ReturnType<typeof fakeHistory>;
  let guard: TrektelBackGuard;
  let active: boolean;
  let answer: boolean;
  const ask = vi.fn(() => answer);
  const stop = vi.fn(() => {
    active = false;
  });

  beforeEach(() => {
    h = fakeHistory();
    vi.stubGlobal('history', h.fake);
    vi.stubGlobal('location', {
      get href() {
        return h.href;
      },
    });
    active = false;
    answer = false;
    ask.mockClear();
    stop.mockClear();
    guard = trektelBackGuard({ active: () => active, ask, stop });
  });

  afterEach(() => {
    guard.dispose();
    vi.unstubAllGlobals();
  });

  /** Vanaf Instellingen naar het hoofdscherm, dan de telling starten */
  function startOnHome() {
    h.navigate('instellingen');
    h.navigate('');
    active = true;
    guard.arm();
  }

  it('vraagt bij terug; nee houdt de telling en het scherm', async () => {
    startOnHome();
    h.fake.back();
    await flush();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    expect(h.href).toBe('https://x/app/#');
    // De extra stap staat er weer: nog eens terug vraagt opnieuw
    h.fake.back();
    await flush();
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('ja stopt de telling en gaat alsnog terug', async () => {
    startOnHome();
    answer = true;
    h.fake.back();
    await flush();
    await flush();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(h.href).toBe('https://x/app/#instellingen');
  });

  it('vraagt niets zonder telling', async () => {
    h.navigate('instellingen');
    h.navigate('');
    h.fake.back();
    await flush();
    expect(ask).not.toHaveBeenCalled();
    expect(h.href).toBe('https://x/app/#instellingen');
  });

  it('na stoppen met de knop gaat één keer terug meteen naar het vorige scherm', async () => {
    startOnHome();
    active = false;
    guard.disarm();
    h.fake.back();
    await flush();
    await flush();
    expect(ask).not.toHaveBeenCalled();
    expect(h.href).toBe('https://x/app/#instellingen');
  });

  it('een editor erboven sluit met terug zonder vraag', async () => {
    startOnHome();
    h.fake.pushState({ editor: true }, '');
    h.fake.back();
    await flush();
    expect(ask).not.toHaveBeenCalled();
    expect(h.href).toBe('https://x/app/#');
  });

  it('zet geen stap boven een open editor', () => {
    h.fake.pushState({ editor: true }, '');
    const before = h.index;
    active = true;
    guard.arm();
    expect(h.index).toBe(before);
  });

  it('weg via een link, telling gestopt: terug slaat de oude stap over', async () => {
    startOnHome();
    h.navigate('sessie/1');
    active = false;
    guard.disarm();
    h.fake.back();
    await flush();
    await flush();
    expect(ask).not.toHaveBeenCalled();
    // Op het hoofdscherm, en de oude stap is overgeslagen
    expect(h.href).toBe('https://x/app/#');
    expect(h.fake.state).toBeNull();
  });
});
