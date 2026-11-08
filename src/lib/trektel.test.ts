import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHUNK_OPTIONS,
  createChunker,
  FRAME_MS,
  levelDb,
  setTrektelEnabled,
  trektelEnabled,
  type Cut,
} from './trektel';

const QUIET = -70;
const WIND = -40;
const VOICE = -20;

/** Voert `ms` lang hetzelfde niveau in; geeft de knippen terug. */
function feed(chunker: ReturnType<typeof createChunker>, db: number, ms: number): Cut[] {
  const cuts: Cut[] = [];
  for (let t = 0; t < ms; t += FRAME_MS) {
    const cut = chunker.push(db);
    if (cut) cuts.push(cut);
  }
  return cuts;
}

/** Praten: woorden met korte dipjes ertussen, zoals echte spraak. */
function speak(chunker: ReturnType<typeof createChunker>, ms: number): Cut[] {
  const cuts: Cut[] = [];
  for (let t = 0; t < ms; t += 500) {
    cuts.push(...feed(chunker, VOICE, 400), ...feed(chunker, QUIET, 100));
  }
  return cuts;
}

describe('createChunker', () => {
  it('knipt niet vóór de doeltijd, ook niet bij een pauze', () => {
    const chunker = createChunker();
    expect(feed(chunker, QUIET, 1000)).toEqual([]);
    expect(speak(chunker, 2000)).toEqual([]);
    expect(feed(chunker, QUIET, 5000)).toEqual([]);
  });

  it('knipt na de doeltijd bij de eerstvolgende pauze', () => {
    const chunker = createChunker();
    feed(chunker, QUIET, 1000);
    expect(speak(chunker, 60_000)).toEqual([]);
    // Een korte stilte (adempauze) is nog geen pauze
    expect(feed(chunker, QUIET, 400)).toEqual([]);
    expect(speak(chunker, 2000)).toEqual([]);
    const [cut] = feed(chunker, QUIET, CHUNK_OPTIONS.pauseMs);
    expect(cut).toMatchObject({ hasSpeech: true });
    // speak() eindigt met een dipje van 100 ms, dat telt mee voor de pauze
    expect(cut.durationMs).toBe(1000 + 60_000 + 400 + 2000 + 600);
    expect(cut.speechMs).toBe(62_000 * 0.8);
  });

  it('knipt hoe dan ook na het maximum, zonder pauze', () => {
    const chunker = createChunker();
    feed(chunker, QUIET, 500);
    const cuts = speak(chunker, CHUNK_OPTIONS.maxMs);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].durationMs).toBe(CHUNK_OPTIONS.maxMs);
  });

  it('een stuk met alleen stilte heeft geen spraak', () => {
    const chunker = createChunker();
    const [cut] = feed(chunker, QUIET, 61_000);
    expect(cut).toMatchObject({ hasSpeech: false, speechMs: 0 });
  });

  it('een kort woord telt al als spraak', () => {
    const chunker = createChunker();
    feed(chunker, QUIET, 2000);
    feed(chunker, VOICE, 300);
    feed(chunker, QUIET, 2000);
    expect(chunker.finish()).toMatchObject({ hasSpeech: true });
  });

  it('aanhoudende wind telt na een tijdje niet meer als spraak', () => {
    const chunker = createChunker();
    feed(chunker, QUIET, 1000);
    feed(chunker, WIND, 2000);
    expect(chunker.speaking).toBe(true);
    feed(chunker, WIND, 60_000);
    expect(chunker.speaking).toBe(false);
    // Spraak boven de wind wel
    feed(chunker, VOICE, 100);
    expect(chunker.speaking).toBe(true);
  });

  it('heel zacht geluid is nooit spraak', () => {
    const chunker = createChunker();
    feed(chunker, -90, 1000);
    feed(chunker, -65, 1000);
    expect(chunker.finish()).toMatchObject({ hasSpeech: false });
  });

  it('het volgende stuk begint na een knip weer bij nul', () => {
    const chunker = createChunker();
    feed(chunker, QUIET, 500);
    speak(chunker, 60_000);
    expect(feed(chunker, QUIET, 1000)).toHaveLength(1);
    expect(chunker.finish()).toMatchObject({ speechMs: 0, hasSpeech: false });
  });
});

describe('levelDb', () => {
  it('rekent het niveau om naar dBFS', () => {
    expect(levelDb(new Float32Array(100).fill(1))).toBeCloseTo(0);
    expect(levelDb(new Float32Array(100).fill(0.1))).toBeCloseTo(-20);
    expect(levelDb(new Float32Array(100))).toBe(-Infinity);
  });
});

describe('instelling', () => {
  beforeEach(() => localStorage.clear());

  it('alleen voor de eigenaar en Maarten', () => {
    setTrektelEnabled(true);
    expect(trektelEnabled()).toBe(false);
    localStorage.setItem('fluistervink.tester', 'Maarten');
    expect(trektelEnabled()).toBe(true);
    localStorage.setItem('fluistervink.tester', 'Jurian');
    expect(trektelEnabled()).toBe(false);
  });

  it('staat standaard uit', () => {
    localStorage.setItem('fluistervink.tester', 'eigenaar');
    expect(trektelEnabled()).toBe(false);
    setTrektelEnabled(true);
    expect(trektelEnabled()).toBe(true);
    setTrektelEnabled(false);
    expect(trektelEnabled()).toBe(false);
  });
});
