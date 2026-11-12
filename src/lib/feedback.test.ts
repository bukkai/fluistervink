import { describe, expect, it } from 'vitest';
import { isEmptyTrektelChunk } from './feedback';

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
