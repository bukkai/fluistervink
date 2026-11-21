import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// public/naar-app.js: wie de app al gebruikt, gaat van de voorpagina (/) meteen
// naar /app/. Een gewoon script (geen module), dus hier als tekst uitgevoerd
// met een nagebootst window.
const source = readFileSync(join(import.meta.dirname, '../public/naar-app.js'), 'utf8');

interface Situatie {
  search?: string;
  hash?: string;
  capacitor?: boolean;
  androidBridge?: boolean;
  standalone?: boolean;
  storage?: Record<string, string>;
  geenStorage?: boolean;
}

/** Waar het script heen stuurt, of undefined als je op de voorpagina blijft */
function run(situatie: Situatie): string | undefined {
  let target: string | undefined;
  const location = {
    search: situatie.search ?? '',
    hash: situatie.hash ?? '',
    replace: (url: string) => {
      target = url;
    },
  };
  const storage = situatie.storage ?? {};
  const win: Record<string, unknown> = {
    location,
    matchMedia: (query: string) => ({
      matches: query === '(display-mode: standalone)' && !!situatie.standalone,
    }),
  };
  if (situatie.capacitor) win.Capacitor = {};
  if (situatie.androidBridge) win.androidBridge = {};
  Object.defineProperty(win, 'localStorage', {
    get() {
      if (situatie.geenStorage) throw new Error('SecurityError');
      return { getItem: (key: string) => storage[key] ?? null };
    },
  });
  new Function('window', 'location', source)(win, location);
  return target;
}

describe('naar-app.js', () => {
  it('laat een nieuwe bezoeker op de voorpagina', () => {
    expect(run({})).toBeUndefined();
    expect(run({ hash: '#' })).toBeUndefined();
    expect(run({ geenStorage: true })).toBeUndefined();
  });

  it('stuurt de Android-app door, ook de oude met / als adres', () => {
    expect(run({ capacitor: true })).toBe('/app/');
    expect(run({ androidBridge: true })).toBe('/app/');
  });

  it('stuurt een geïnstalleerde PWA door', () => {
    expect(run({ standalone: true })).toBe('/app/');
  });

  it('stuurt door wie in deze browser de app al gebruikte', () => {
    expect(run({ storage: { 'fluistervink.installId': 'abc' } })).toBe('/app/');
    expect(run({ storage: { 'fluistervink.accessCode': 'geheim' } })).toBe('/app/');
  });

  it('houdt oude links naar een scherm van de app heel', () => {
    expect(run({ hash: '#privacy' })).toBe('/app/#privacy');
    expect(run({ hash: '#sessie/12', search: '?x=1' })).toBe('/app/?x=1#sessie/12');
  });

  it('laat met ?voorpagina altijd de voorpagina zien', () => {
    expect(run({ search: '?voorpagina', capacitor: true })).toBeUndefined();
    expect(
      run({ search: '?voorpagina', storage: { 'fluistervink.installId': 'abc' } }),
    ).toBeUndefined();
  });
});
