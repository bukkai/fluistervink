import { beforeEach, describe, expect, it } from 'vitest';
import {
  leavesSessionScreen,
  CHUNK_OPTIONS,
  createChunker,
  FRAME_MS,
  levelDb,
  setTrektelEnabled,
  trektelBacklog,
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

  it('een meting met alleen nullen zet het achtergrondniveau niet vast', () => {
    const chunker = createChunker();
    // De eerste meting na het aanzetten van de microfoon is vaak leeg
    chunker.push(-Infinity);
    feed(chunker, WIND, 120_000);
    expect(chunker.speaking).toBe(false);
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

  it('staat standaard uit', () => {
    expect(trektelEnabled()).toBe(false);
    setTrektelEnabled(true);
    expect(trektelEnabled()).toBe(true);
    setTrektelEnabled(false);
    expect(trektelEnabled()).toBe(false);
  });
});

describe('leavesSessionScreen', () => {
  it('ziet een ander scherm, niet het hoofdscherm of een andere site', () => {
    expect(leavesSessionScreen('#instellingen')).toBe(true);
    expect(leavesSessionScreen('#sessie/abc')).toBe(true);
    expect(leavesSessionScreen('#/')).toBe(false);
    expect(leavesSessionScreen('#')).toBe(false);
    expect(leavesSessionScreen('https://waarneming.nl')).toBe(false);
    expect(leavesSessionScreen(null)).toBe(false);
  });
});

describe('trektelBacklog', () => {
  const now = 1_800_000_000_000;
  const min = 60_000;
  const stuk = (agoMin: number, status: 'pending' | 'processing' | 'done' = 'pending') => ({
    status,
    trektel: true as const,
    recordedAt: now - agoMin * min,
  });

  it('telt de wachtende stukken en de minuten sinds het oudste', () => {
    const utterances = [stuk(12, 'done'), stuk(8, 'processing'), stuk(6), stuk(3), stuk(1)];
    expect(trektelBacklog(utterances, now)).toEqual({ n: 4, minutes: 8 });
  });

  it('niets bij één wachtend stuk of minder dan twee minuten', () => {
    expect(trektelBacklog([stuk(8)], now)).toBeUndefined();
    expect(trektelBacklog([stuk(1.2), stuk(0.5)], now)).toBeUndefined();
  });

  it('niets als er ook een ingesproken uitspraak wacht', () => {
    const knop = { status: 'pending' as const, recordedAt: now - 5 * min };
    expect(trektelBacklog([stuk(8), stuk(4), knop], now)).toBeUndefined();
  });
});
