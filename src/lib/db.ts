import Dexie, { type EntityTable } from 'dexie';
import type { Area } from './api';
import type { LogEvent } from './log';

// Datamodel, zie CLAUDE.md. ID's zijn UUID's (crypto.randomUUID), zodat ze
// later ook buiten dit apparaat uniek blijven. Tijden zijn epoch-milliseconden.

export interface Position {
  lat: number;
  lon: number;
  /** GPS-nauwkeurigheid in meters */
  accuracy: number;
  /** Moment van de GPS-meting; kan iets eerder zijn dan de uitspraak */
  fixedAt: number;
}

/** Hoe de positie bij een uitspraak tot stand kwam, voor analyse */
export interface PositionLookup {
  /**
   * `recent`: meting van de warme GPS, hooguit 15 s oud. `fresh`: nieuw
   * opgevraagd. `last_known`: verse meting lukte niet, laatst bekende positie
   * (kan oud zijn). `none`: geen positie.
   */
  source: 'recent' | 'fresh' | 'last_known' | 'none';
  position?: Position;
  /** Hoe lang het zoeken duurde */
  waitMs: number;
  /** Waarom een verse meting mislukte, of de GPS-status bij `none` */
  error?: string;
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt?: number;
  status: 'active' | 'ended';
  /** Laatst geëxporteerd voor waarneming.nl */
  exportedAt?: number;
}

export interface Utterance {
  id: string;
  sessionId: string;
  /** Moment waarop de opname startte */
  recordedAt: number;
  position?: Position;
  /** Hoe `position` gevonden werd (zonder de positie zelf) */
  positionLookup?: Omit<PositionLookup, 'position'>;
  /**
   * Gebied van waarneming.nl waarin de positie ligt ("Schoorlse Duinen").
   * Leeg = nog niet opgezocht; null = opgezocht, maar geen gebied gevonden.
   */
  area?: Area | null;
  /** Opname bij een ingesproken uitspraak; leeg bij getypte invoer */
  audio?: Blob;
  audioDurationMs?: number;
  /** Bij een opname leeg tot de spraakherkenning klaar is */
  transcript?: string;
  /** Meetgegevens van de spraakherkenning, voor de vergelijking van STT-opties */
  transcription?: TranscriptionMetrics;
  /** Ruwe uitvoer van het LLM (tool calls), bewaard voor de testset */
  llmOutput?: unknown;
  status: 'pending' | 'processing' | 'done' | 'failed';
  /**
   * `dev_note`: een bevinding over de app ("dev note, …") in plaats van een
   * waarneming. Gaat niet naar het model. Leeg = gewone uitspraak.
   */
  kind?: 'dev_note';
  /**
   * Uitkomst na verwerking; bepaalt later ook het trilpatroon.
   * `ignored`: geen waarneming in de uitspraak (of niet begrepen).
   * `note`: opgeslagen als dev note.
   */
  result?: 'saved' | 'uncertain' | 'ignored' | 'note';
  /** Foutmelding bij status `failed`, of acties die niet uitgevoerd konden worden */
  error?: string;
  /** Wat deze uitspraak in de database veranderde, zodat `undo` het kan terugdraaien */
  changes?: Change[];
  /** Teruggedraaid door een latere `undo` */
  undone?: boolean;
  /** Aantal verwerkingspogingen (meer dan 1 na "Opnieuw" of een herstart) */
  attempts?: number;
  /** Meetgegevens van de laatste verwerkingspoging, voor analyse */
  metrics?: ProcessingMetrics;
}

export interface TranscriptionMetrics {
  model: string;
  /** Korte hash van model en prompt */
  promptVersion: string;
  /** Duur van het verzoek aan de proxy, en daarvan de tijd bij OpenAI */
  requestMs: number;
  upstreamMs?: number;
}

export interface ProcessingMetrics {
  /** Commit van de app die de uitspraak verwerkte */
  appVersion: string;
  model: string;
  /** Korte hash van systeemprompt en tools; verandert bij elke promptwijziging */
  promptVersion: string;
  /** De recente waarnemingen zoals het model ze kreeg */
  context: string;
  /**
   * Begin en eind van de verwerking (inclusief spraakherkenning). Begin min
   * einde van de uitspraak (`recordedAt` + `audioDurationMs`) = tijd in de wachtrij.
   */
  startedAt: number;
  finishedAt: number;
  /** Duur van het verzoek aan de proxy, en daarvan de tijd bij Anthropic */
  requestMs?: number;
  upstreamMs?: number;
  /** De app was tussen uitspraak en eind verwerking (even) op de achtergrond */
  wasHidden: boolean;
  online: boolean;
}

export type Change =
  | { type: 'add'; observationId: string }
  | { type: 'update'; observationId: string; before: Partial<Observation> }
  | { type: 'delete'; observation: Observation };

export interface Observation {
  id: string;
  sessionId: string;
  /** De uitspraak waaruit deze waarneming kwam */
  utteranceId: string;
  /** waarneming.nl-ID's, zie data/ en docs/waarneming-nl.md */
  speciesId: number;
  count: number;
  countingMethodId?: number;
  activityId?: number;
  methodId?: number;
  /** Kleed en leeftijd zijn bij waarneming.nl één veld (life_stage) */
  lifeStageId?: number;
  /** Geslacht is in de API een vaste keuze, geen ID */
  sex?: 'male' | 'female' | 'unknown';
  observedAt: number;
  /** Volgorde van aanmaken, voor waarnemingen uit dezelfde uitspraak */
  createdAt: number;
  position?: Position;
  /** Gebied van waarneming.nl, overgenomen van de uitspraak */
  area?: Area | null;
  uncertain: boolean;
  /** Waarom het model twijfelde, om de review makkelijker te maken */
  uncertainReason?: string;
  /**
   * Vrije opmerking van de gebruiker ("bij thuiskomst terugluisteren").
   * Gaat bij de CSV-export mee in `Species Comments`.
   */
  remarks?: string;
  /** Laatst met de hand aangepast (in de review); leeg = zoals het model hem maakte */
  editedAt?: number;
  status: 'draft' | 'reviewed' | 'exported';
}

export const db = new Dexie('thijsse') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
  utterances: EntityTable<Utterance, 'id'>;
  observations: EntityTable<Observation, 'id'>;
  events: EntityTable<LogEvent, 'id'>;
};

// Alleen velden waarop we zoeken staan in het schema; de rest wordt gewoon
// meeopgeslagen. Bij een schemawijziging: nieuwe db.version(n) toevoegen.
db.version(1).stores({
  sessions: 'id, status, startedAt',
  utterances: 'id, sessionId, status, recordedAt',
  observations: 'id, sessionId, utteranceId, observedAt',
});

db.version(2).stores({
  events: '++id, at, type',
});
