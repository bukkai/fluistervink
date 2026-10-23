import { db, type Observation, type Session } from './db';
import { saveFile } from './export';
import { logEvent } from './log';
import { isNativeApp } from './native';
import { listObservations } from './observations';
import {
  allActivities,
  allLifeStages,
  allMethods,
  countingMethods,
  getSpecies,
  type Code,
} from './vocab';
import { buildXlsx } from './xlsx';

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

/** Kolommen die in een xlsx een getal zijn, zoals in het voorbeeld van waarneming.nl */
const NUMERIC = new Set<string>(['lat', 'lng', 'accuracy', 'number']);

/**
 * CSV, of xlsx in de Android-app: een .csv krijgt daar van Android een type
 * dat het uploadveld van waarneming.nl uitgrijst (15 okt). In de browser
 * blijft het CSV, de vorm die in een echte import is getest.
 */
export type ExportFormat = 'csv' | 'xlsx';

export interface WaarnemingExport {
  file: Blob;
  filename: string;
  /** De wandelingen in het bestand */
  sessions: Session[];
  /** De waarnemingen die in het bestand staan */
  exported: Observation[];
  /** Waarnemingen zonder positie: de import weigert die, dus ze blijven eruit */
  skipped: Observation[];
  /** Uitgevinkt in de review */
  excluded: Observation[];
}

/** Eén CSV voor een of meer wandelingen (waarneming.nl neemt er tot 5000 tegelijk). */
export async function buildExport(
  sessions: Session[],
  format: ExportFormat = 'csv',
): Promise<WaarnemingExport> {
  sessions = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  // Op volgorde van tijd (de lijst in de app toont de nieuwste eerst)
  const observations = (await Promise.all(sessions.map((s) => listObservations(s.id))))
    .flat()
    .sort((a, b) => a.observedAt - b.observedAt || a.createdAt - b.createdAt);
  const excluded = observations.filter((obs) => obs.skipExport);
  const included = observations.filter((obs) => !obs.skipExport);
  const exported = included.filter((obs) => obs.position);
  const skipped = included.filter((obs) => !obs.position);
  const rows = exported.map(toRow);
  return {
    file: format === 'xlsx' ? toXlsx(rows) : toCsv(rows),
    filename: `${filename(sessions)}.${format}`,
    sessions,
    exported,
    skipped,
    excluded,
  };
}

// Eén wandeling: met de begintijd, zodat twee wandelingen op één dag niet
// hetzelfde bestand lijken (en je niet per ongeluk het verkeerde uploadt).
// Meer wandelingen: van de eerste tot de laatste dag.
function filename(sessions: Session[]): string {
  const first = new Date(sessions[0].startedAt);
  if (sessions.length === 1) return `waarneming-${fileTimestamp(first)}`;
  const last = new Date(sessions[sessions.length - 1].startedAt);
  const days = [isoDate(first), isoDate(last)];
  return `waarneming-${days[0] === days[1] ? days[0] : days.join('-tot-')}-${sessions.length}-wandelingen`;
}

/** Na het opslaan: waarnemingen en wandelingen markeren als geëxporteerd. */
export async function markExported(
  sessions: Session[],
  observations: Observation[],
): Promise<void> {
  const exportedAt = Date.now();
  await db.transaction('rw', db.sessions, db.observations, async () => {
    await db.observations.bulkUpdate(
      observations.map((obs) => ({ key: obs.id, changes: { status: 'exported' as const } })),
    );
    await db.sessions.bulkUpdate(sessions.map((s) => ({ key: s.id, changes: { exportedAt } })));
  });
}

/** Nagelopen en klaar voor waarneming.nl, of toch nog niet. */
export async function markReady(sessionId: string, ready: boolean): Promise<void> {
  await db.sessions.update(sessionId, { readyAt: ready ? Date.now() : undefined });
}

/**
 * "Alles klopt": alle waarnemingen die nog niet nagelopen waren gelden als
 * nagelopen, en de wandeling staat klaar. Telt niet als correctie (geen
 * `editedAt`), behalve bij de onzekere: die worden zeker, net als met "Klopt".
 */
export async function approveSession(sessionId: string): Promise<void> {
  const editedAt = Date.now();
  await db.transaction('rw', db.sessions, db.observations, async () => {
    await db.observations
      .where('sessionId')
      .equals(sessionId)
      .filter((obs) => obs.status !== 'exported' && (obs.status === 'draft' || obs.uncertain))
      .modify((obs) => {
        obs.status = 'reviewed';
        if (!obs.uncertain) return;
        obs.uncertain = false;
        delete obs.uncertainReason;
        obs.editedAt = editedAt;
      });
    await markReady(sessionId, true);
  });
}

/** Wandelingen die klaarstaan en nog niet geëxporteerd zijn. */
export function readyForExport(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.readyAt && !s.exportedAt);
}

/**
 * Exporteren vanuit het scherm: waarschuwen, opslaan en markeren. Geeft de
 * uitkomst als tekst terug, of niets als de gebruiker annuleert. Alleen als
 * geëxporteerd markeren als het bestand er echt is (14 okt: de Android-app
 * markeerde zonder bestand).
 */
export async function exportForWaarneming(sessions: Session[]): Promise<string | undefined> {
  const result = await buildExport(sessions, isNativeApp ? 'xlsx' : 'csv');
  if (result.exported.length === 0) return 'Geen waarnemingen met een locatie om te exporteren.';
  const uncertain = result.exported.filter((obs) => obs.uncertain).length;
  const earlier = result.sessions.filter((s) => s.exportedAt).length;
  const warnings = [
    uncertain > 0 &&
      `${uncertain} ${uncertain === 1 ? 'waarneming is' : 'waarnemingen zijn'} nog onzeker ` +
        `en ${uncertain === 1 ? 'gaat' : 'gaan'} mee als "niet zeker".`,
    earlier > 0 &&
      `${sessions.length === 1 ? 'Deze wandeling is' : `${earlier} van deze wandelingen zijn`} ` +
        'al eerder geëxporteerd. Waarneming.nl weigert de hele import als er een waarneming in ' +
        'zit die al is ingevoerd.',
  ].filter(Boolean);
  if (warnings.length && !confirm([...warnings, 'Toch exporteren?'].join('\n\n'))) return;

  let saved;
  try {
    saved = await saveFile(result.file, result.filename);
    if (!saved) return;
  } catch (error) {
    logEvent('export_failed', { error: String(error) });
    return `Opslaan mislukt: ${error instanceof Error ? error.message : error}`;
  }
  await markExported(result.sessions, result.exported);
  const n = result.exported.length;
  const walks = result.sessions.length;
  return [
    `${n === 1 ? '1 waarneming' : `${n} waarnemingen`}` +
      (walks > 1 ? ` uit ${walks} wandelingen` : '') +
      ' geëxporteerd.',
    saved.folder && `Het bestand staat in ${saved.folder}.`,
    result.skipped.length &&
      `${result.skipped.length} zonder locatie overgeslagen; voer die met de hand in.`,
    result.excluded.length && `${result.excluded.length} uitgevinkt en niet geëxporteerd.`,
  ]
    .filter(Boolean)
    .join(' ');
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
    activity: english(allActivities, obs.activityId),
    'life stage': english(allLifeStages, obs.lifeStageId),
    method: english(allMethods, obs.methodId),
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

function toCsv(rows: Row[]): Blob {
  const lines = [
    COLUMNS.map(csvField).join(','),
    ...rows.map((row) => COLUMNS.map((column) => csvField(row[column])).join(',')),
  ];
  // CRLF en UTF-8 (zonder BOM, anders hoort die bij de eerste kolomnaam)
  return new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

function toXlsx(rows: Row[]): Blob {
  return buildXlsx([
    [...COLUMNS],
    ...rows.map((row) =>
      COLUMNS.map((column) =>
        NUMERIC.has(column) && row[column] !== '' ? Number(row[column]) : row[column],
      ),
    ),
  ]);
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Datum in de lokale tijd van het apparaat, als YYYY-MM-DD */
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Datum en begintijd voor de bestandsnaam, als YYYY-MM-DD-HHMM */
function fileTimestamp(date: Date): string {
  return `${isoDate(date)}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
