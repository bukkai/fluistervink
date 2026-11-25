import { afterEach, describe, expect, it, vi } from 'vitest';
import { canVibrate, isEmptyTrektelChunk } from './feedback';

describe('isEmptyTrektelChunk', () => {
  it('alleen een trektelstuk zonder tekst', () => {
    expect(isEmptyTrektelChunk({ trektel: true, transcript: '', result: 'ignored' })).toBe(true);
    expect(isEmptyTrektelChunk({ trektel: true, transcript: ' ', result: 'ignored' })).toBe(true);
    // Wel iets gezegd maar geen vogel: gewoon "niet begrepen"
    expect(isEmptyTrektelChunk({ trektel: true, transcript: 'Eh', result: 'ignored' })).toBe(false);
    // Buiten de trektelling drukte de gebruiker zelf: dan wel melden
    expect(isEmptyTrektelChunk({ transcript: '', result: 'ignored' })).toBe(false);
  });
});

describe('canVibrate', () => {
  afterEach(() => vi.unstubAllGlobals());

  function device(vibrate: boolean, coarse: boolean) {
    vi.stubGlobal('navigator', { ...navigator, vibrate: vibrate ? () => true : undefined });
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: coarse && query.includes('coarse'),
    }));
  }

  it('trilt op een telefoon met de Vibration API', () => {
    device(true, true);
    expect(canVibrate()).toBe(true);
  });

  it('niet op een laptop, ook al heeft Chrome daar navigator.vibrate', () => {
    device(true, false);
    expect(canVibrate()).toBe(false);
  });

  it('niet zonder de Vibration API (Safari op de iPhone)', () => {
    device(false, true);
    expect(canVibrate()).toBe(false);
  });
});
