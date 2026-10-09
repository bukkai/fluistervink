import Dexie, { type EntityTable } from 'dexie';

// Datamodel, zie CLAUDE.md. ID's zijn UUID's (crypto.randomUUID), zodat ze
// later ook buiten dit apparaat uniek blijven. Tijden zijn epoch-milliseconden.

export interface Position {
  lat: number;
  lon: number;
  /** GPS-nauwkeurigheid in meters */
  accuracy: number;
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt?: number;
  status: 'active' | 'ended';
}

export interface Utterance {
  id: string;
  sessionId: string;
  /** Moment waarop de opname startte */
  recordedAt: number;
  position?: Position;
  audio?: Blob;
  transcript?: string;
  /** Ruwe uitvoer van het LLM (tool calls), bewaard voor de testset */
  llmOutput?: unknown;
  status: 'pending' | 'processing' | 'done' | 'failed';
  /**
   * Uitkomst na verwerking; bepaalt later ook het trilpatroon.
   * `ignored`: geen waarneming in de uitspraak (of niet begrepen).
   */
  result?: 'saved' | 'uncertain' | 'ignored';
  /** Foutmelding bij status `failed`, of acties die niet uitgevoerd konden worden */
  error?: string;
  /** Wat deze uitspraak in de database veranderde, zodat `undo` het kan terugdraaien */
  changes?: Change[];
  /** Teruggedraaid door een latere `undo` */
  undone?: boolean;
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
  uncertain: boolean;
  /** Waarom het model twijfelde, om de review makkelijker te maken */
  uncertainReason?: string;
  status: 'draft' | 'reviewed' | 'exported';
}

export const db = new Dexie('thijsse') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
  utterances: EntityTable<Utterance, 'id'>;
  observations: EntityTable<Observation, 'id'>;
};

// Alleen velden waarop we zoeken staan in het schema; de rest wordt gewoon
// meeopgeslagen. Bij een schemawijziging: nieuwe db.version(n) toevoegen.
db.version(1).stores({
  sessions: 'id, status, startedAt',
  utterances: 'id, sessionId, status, recordedAt',
  observations: 'id, sessionId, utteranceId, observedAt',
});
