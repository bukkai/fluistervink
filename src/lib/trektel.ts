// Trektelmodus (docs/plan-trektelmodus.md): de microfoon blijft aan en de app
// knipt wat je zegt in stukken, bij een pauze. Elk stuk wordt een gewone
// uitspraak met eigen tijd en plek. Stukken zonder spraak gaan niet naar de
// spraakherkenning.
//
// Hier alleen de rekenregels (wanneer knippen, zit er spraak in), zonder
// browser-API's, zodat ze te testen zijn. De opname zelf staat in
// trektelRecorder.svelte.ts.

import { getTester } from './api';

/** Zo vaak meet de opname het geluidsniveau. */
export const FRAME_MS = 100;

export interface ChunkerOptions {
  /** Na zo lang knippen bij de eerstvolgende pauze */
  targetMs: number;
  /** Zo lang stil = een pauze */
  pauseMs: number;
  /** Zonder pauze hoe dan ook knippen (de oude limiet van een opname) */
  maxMs: number;
  /** Minder spraak dan dit = stilte, niet versturen. Liever wind versturen dan een zacht "twee sperwers" weggooien. */
  minSpeechMs: number;
  /** Zoveel dB boven het achtergrondgeluid = spraak */
  marginDb: number;
  /** Zachter dan dit is nooit spraak (dBFS) */
  absoluteFloorDb: number;
}

export const CHUNK_OPTIONS: ChunkerOptions = {
  targetMs: 60_000,
  pauseMs: 700,
  maxMs: 3 * 60_000,
  minSpeechMs: 300,
  marginDb: 10,
  absoluteFloorDb: -60,
};

/** Hoe snel het achtergrondniveau mag stijgen, in dB per meting (0,5 dB per seconde). */
const FLOOR_RISE_DB = 0.05;

export interface Cut {
  /** Lengte van het stuk */
  durationMs: number;
  /** Hoeveel daarvan spraak was */
  speechMs: number;
  /** Genoeg spraak om te versturen */
  hasSpeech: boolean;
  /** Hardste meting (dBFS) en achtergrondniveau, voor het log */
  peakDb: number;
  floorDb: number;
}

/**
 * Houdt per stuk bij hoe lang het loopt, hoeveel spraak erin zit en hoe lang
 * het al stil is. Het achtergrondniveau (wind, verkeer) volgt het zachtste
 * geluid: zakt meteen mee, stijgt langzaam, zodat een aanhoudende wind na een
 * tijdje niet meer als spraak telt.
 */
export function createChunker(options: ChunkerOptions = CHUNK_OPTIONS) {
  let elapsedMs = 0;
  let speechMs = 0;
  let silentMs = 0;
  let peakDb = -Infinity;
  let floorDb: number | undefined;
  let speaking = false;

  function reset() {
    elapsedMs = 0;
    speechMs = 0;
    silentMs = 0;
    peakDb = -Infinity;
  }

  function summary(): Cut {
    return {
      durationMs: elapsedMs,
      speechMs,
      hasSpeech: speechMs >= options.minSpeechMs,
      peakDb: Math.round(peakDb),
      floorDb: Math.round(floorDb ?? -Infinity),
    };
  }

  return {
    /** Of de laatste meting spraak was (voor het lampje op het scherm) */
    get speaking() {
      return speaking;
    },

    /**
     * Eén meting van `frameMs` met niveau `levelDb` (dBFS). Geeft een `Cut`
     * terug als het stuk hier eindigt; het volgende begint dan meteen.
     */
    push(levelDb: number, frameMs = FRAME_MS): Cut | undefined {
      floorDb = floorDb === undefined || levelDb < floorDb ? levelDb : floorDb + FLOOR_RISE_DB;
      speaking = levelDb > options.absoluteFloorDb && levelDb > floorDb + options.marginDb;

      elapsedMs += frameMs;
      peakDb = Math.max(peakDb, levelDb);
      if (speaking) {
        speechMs += frameMs;
        silentMs = 0;
      } else {
        silentMs += frameMs;
      }

      const pause = elapsedMs >= options.targetMs && silentMs >= options.pauseMs;
      if (!pause && elapsedMs < options.maxMs) return undefined;
      const cut = summary();
      reset();
      return cut;
    },

    /** Het laatste stuk, bij het stoppen. */
    finish(): Cut {
      const cut = summary();
      reset();
      return cut;
    },
  };
}

/** Niveau van een reeks samples (-1…1) in dBFS. */
export function levelDb(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  const rms = Math.sqrt(sum / (samples.length || 1));
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

/** Een trektelling stopt hoe dan ook na zo lang. */
export const TREKTEL_MAX_MS = 4 * 60 * 60_000;

/** Fase 1: alleen voor de eigenaar en Maarten (die de proef doet). */
const TREKTEL_TESTERS = ['eigenaar', 'Maarten'];

export function trektelAvailable(): boolean {
  return TREKTEL_TESTERS.includes(getTester() ?? '');
}

const SETTING_KEY = 'fluistervink.trektelmodus';

/** Staat de trektelmodus aan bij Instellingen (en mag deze gebruiker hem)? */
export function trektelEnabled(): boolean {
  try {
    return trektelAvailable() && localStorage.getItem(SETTING_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTrektelEnabled(on: boolean): void {
  if (on) localStorage.setItem(SETTING_KEY, '1');
  else localStorage.removeItem(SETTING_KEY);
}
