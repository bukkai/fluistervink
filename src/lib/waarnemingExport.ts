import { db, type Observation, type Session } from './db';
import { listObservations } from './observations';
import {
  activities,
  countingMethods,
  getSpecies,
  lifeStages,
  methods,
  type Code,
} from './vocab';

// Export van een wandeling voor de bulkimport van waarneming.nl
// (https://waarneming.nl/import/observations/, zie docs/waarneming-nl.md).
// Gedrag, methode, kleed en telmethode herkent de import alleen aan de tekst
// in de taal van de site; wij exporteren in het Engels.

export const IMPORT_URL = 'https://waarneming.nl/import/observations/';

const COLUMNS = [
  'date',
  'time',
  'scientific name',
  'lat',
  'lng',
  'accuracy',
  'number',
  'notes',
  'sex',
  'is certain',
  'activity',
  'life stage',
  'method',
  'counting method',
  'uuid',
] as const;

type Row = Record<(typeof COLUMNS)[number], string>;

export interface WaarnemingExport {
  csv: Blob;
  filename: string;
  /** De waarnemingen die in het bestand staan */
  exported: Observation[];
  /** Waarnemingen zonder positie: de import weigert die, dus ze blijven eruit */
  skipped: Observation[];
  /** Uitgevinkt in de review */
  excluded: Observation[];
}

export async function buildExport(session: Session): Promise<WaarnemingExport> {
  // Op volgorde van tijd (de lijst in de app toont de nieuwste eerst)
  const observations = (await listObservations(session.id)).sort(
    (a, b) => a.observedAt - b.observedAt || a.createdAt - b.createdAt,
  );
  const excluded = observations.filter((obs) => obs.skipExport);
  const included = observations.filter((obs) => !obs.skipExport);
  const exported = included.filter((obs) => obs.position);
  const skipped = included.filter((obs) => !obs.position);
  const lines = [COLUMNS.map(csvField).join(','), ...exported.map((obs) => toLine(toRow(obs)))];
  return {
    // CRLF en UTF-8 (zonder BOM, anders hoort die bij de eerste kolomnaam)
    csv: new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }),
    filename: `waarneming-${isoDate(new Date(session.startedAt))}.csv`,
    exported,
    skipped,
    excluded,
  };
}

/** Na het downloaden: waarnemingen en wandeling markeren als geëxporteerd. */
export async function markExported(session: Session, observations: Observation[]): Promise<void> {
  await db.transaction('rw', db.sessions, db.observations, async () => {
    await db.observations.bulkUpdate(
      observations.map((obs) => ({ key: obs.id, changes: { status: 'exported' as const } })),
    );
    await db.sessions.update(session.id, { exportedAt: Date.now() });
  });
}

function toRow(obs: Observation): Row {
  const position = obs.position!;
  const at = new Date(obs.observedAt);
  return {
    date: isoDate(at),
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
    'scientific name': getSpecies(obs.speciesId)?.scientific ?? '',
    lat: position.lat.toFixed(6),
    lng: position.lon.toFixed(6),
    // Toegestaan t/m 1000 m; 999 betekent "onbekend"
    accuracy: String(position.accuracy <= 1000 ? Math.max(1, Math.round(position.accuracy)) : 999),
    number: String(obs.count),
    notes: notes(obs),
    sex: obs.sex === 'male' ? 'M' : obs.sex === 'female' ? 'F' : 'U',
    'is certain': obs.uncertain ? 'False' : 'True',
    activity: english(activities, obs.activityId),
    'life stage': english(lifeStages, obs.lifeStageId),
    method: english(methods, obs.methodId),
    'counting method': english(countingMethods, obs.countingMethodId),
    // Waarneming.nl weigert een import met een uuid die al bestaat: zo kan
    // dezelfde waarneming niet twee keer worden ingevoerd
    uuid: obs.id,
  };
}

// Alleen de opmerking gaat mee. De twijfelreden is een uitleg van het model
// voor het nalopen thuis; de twijfel zelf gaat al mee als zekerheid.
function notes(obs: Observation): string {
  return obs.remarks ?? '';
}

function english(codes: Code[], id: number | undefined): string {
  return codes.find((c) => c.id === id)?.en ?? '';
}

function toLine(row: Row): string {
  return COLUMNS.map((column) => csvField(row[column])).join(',');
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Datum in de lokale tijd van het apparaat, als YYYY-MM-DD */
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
