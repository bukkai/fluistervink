import ebirdNames from '../../data/ebird-namen.json';
import {
  db,
  isShielded,
  type Checklist,
  type EbirdProtocol,
  type Observation,
  type Session,
} from './db';
import { ebirdProtocol, sessionDurationMs } from './effort';
import { saveFile } from './export';
import { errorText } from './format';
import { t } from './i18n';
import { logEvent } from './log';
import { listObservations, listUtterances } from './observations';
import { activityName, BIRDS, getSpecies, groupOf, methodName } from './vocab';
import { fileTimestamp, isoDate, pad } from './waarnemingExport';

// Export van sessies als eBird-checklists, voor de import bij eBird
// (Submit → Import data, "eBird Record Format"; docs/archief/plan-ebird.md, fase 2).
// Eén sessie = één checklist, één regel per soort. Het formaat: CSV zonder
// kopregel en zonder aanhalingstekens, 19 kolommen in een vaste volgorde
// (bijlage A van de importhandleiding van eBird, nagekeken op 12 nov 2026
// tegen het voorbeeldbestand). Soorten gaan met hun eBird-naam en hun
// wetenschappelijke naam (data/ebird-namen.json, gekoppeld door
// scripts/fetch-species.mjs); wat eBird niet kent, kiest de gebruiker bij de
// import zelf ("Fix Species").

export const EBIRD_IMPORT_URL = 'https://ebird.org/import/upload.form';

export const COLUMNS = [
  'Common Name',
  'Genus',
  'Species',
  'Number',
  'Species Comments',
  'Location Name',
  'Latitude',
  'Longitude',
  'Date',
  'Start Time',
  'State/Province',
  'Country Code',
  'Protocol',
  'Number of Observers',
  'Duration',
  'All observations reported?',
  'Effort Distance Miles',
  'Effort area acres',
  'Submission Comments',
] as const;

type Row = Record<(typeof COLUMNS)[number], string>;

const METERS_PER_MILE = 1609.344;
/** eBird raadt aan een lopende checklist korter te houden (anders minder bruikbaar) */
const LONG_TRAVELING_M = 8000;
/** eBird neemt een duur tot 24 uur, exclusief */
const MAX_DURATION_MIN = 1439;
const MAX_COUNT = 999_999;

/**
 * Kaders (zuid, noord, west, oost) die helemaal binnen één land liggen, met
 * wat afstand tot de grens. Samen dekken ze het grootste deel van Nederland
 * (niet Zuid-Limburg, het zuiden van Brabant rond Baarle en Zeeuws-
 * Vlaanderen), het midden en de kust van België, en een deel van Spanje
 * (ontwikkeloptie "Spanje").
 */
const INSIDE: [code: string, box: [number, number, number, number]][] = [
  // Zeeland, Holland, Utrecht, het noorden van Brabant, Friesland, tot Arnhem
  ['NL', [51.5, 53.45, 4.0, 5.9]],
  ['NL', [51.38, 51.75, 3.4, 4.0]],
  // Overijssel, Drenthe, Groningen
  ['NL', [52.15, 53.3, 5.9, 6.95]],
  // De Achterhoek
  ['NL', [51.9, 52.15, 5.9, 6.6]],
  ['BE', [50.5, 51.0, 3.6, 5.5]],
  ['BE', [51.0, 51.25, 2.7, 3.3]],
  ['ES', [37.0, 42.0, -6.0, 0.0]],
  ['ES', [38.6, 40.1, 1.15, 4.35]],
  ['ES', [27.6, 29.5, -18.2, -13.4]],
];

/**
 * Landcode voor eBird bij een plek, alleen als die zeker in dat land ligt;
 * anders leeg. eBird vraagt het land niet verplicht (bijlage A: `DEFAULT
 * NULL`; de plek staat er met coördinaten in), en een verkeerd land is erger dan
 * geen: tot 25 nov stond er altijd NL, ook in België of Spanje.
 */
export function countryCode(lat: number | undefined, lon: number | undefined): string {
  if (lat === undefined || lon === undefined) return '';
  const inside = INSIDE.find(
    ([, [south, north, west, east]]) => lat >= south && lat <= north && lon >= west && lon <= east,
  );
  return inside?.[0] ?? '';
}
/** Telmethode "gezien niet geteld": in eBird een X (aanwezig, niet geteld) */
const NOT_COUNTED = 3;
const CHECKLIST_COMMENT = 'Ingesproken met Fluistervink';

/** De checklist zoals hij naar eBird gaat: gemeten inspanning plus wat de gebruiker invulde */
export interface ResolvedChecklist {
  protocol: EbirdProtocol;
  /** Leeg als er niets gemeten of ingevuld is (sessies van vóór 11 nov) */
  distanceM?: number;
  durationMin: number;
  observers: number;
  complete?: boolean;
}

/**
 * Wat de app kiest als de gebruiker niets invulde: het protocol uit de
 * afstand, en zonder gemeten afstand (oude sessies) Incidental, want een
 * lopende checklist zonder afstand neemt eBird niet.
 */
export function resolveChecklist(session: Session): ResolvedChecklist {
  const checklist = session.checklist ?? {};
  const distanceM = checklist.distanceM ?? session.effort?.distanceM;
  const measured = session.effort
    ? ebirdProtocol({ ...session.effort, distanceM: distanceM! })
    : undefined;
  const minutes = Math.round(
    sessionDurationMs(session, session.endedAt ?? session.startedAt) / 60_000,
  );
  return {
    protocol: checklist.protocol ?? measured ?? 'Incidental',
    distanceM,
    durationMin: Math.min(MAX_DURATION_MIN, Math.max(1, minutes)),
    observers: checklist.observers ?? lastObservers(),
    complete: checklist.complete,
  };
}

const OBSERVERS_KEY = 'fluistervink.ebird.observers';

/** Laatst gekozen aantal waarnemers: wie altijd met z'n tweeën vogelt, hoeft het niet steeds in te vullen */
export function lastObservers(): number {
  try {
    const n = Number(localStorage.getItem(OBSERVERS_KEY));
    return Number.isInteger(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

/** Antwoorden bij de checklist bewaren; `undefined` wist een veld (terug naar wat de app kiest) */
export async function setChecklist(sessionId: string, changes: Partial<Checklist>): Promise<void> {
  if (changes.observers !== undefined) {
    try {
      localStorage.setItem(OBSERVERS_KEY, String(changes.observers));
    } catch {
      // Geen opslag: dan is het volgende keer weer 1
    }
  }
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return;
    const checklist: Checklist = { ...session.checklist, ...changes };
    for (const key of Object.keys(checklist) as (keyof Checklist)[]) {
      if (checklist[key] === undefined) delete checklist[key];
    }
    await db.sessions.update(sessionId, { checklist });
  });
}

/**
 * Sessies voor "Exporteren voor eBird" op het scherm Sessies: nagelopen
 * (klaar, of al naar waarneming.nl), nog niet naar eBird, en niet op "niet
 * naar eBird" gezet. Sessies van voordat de gebruiker eBird aanzette (`since`)
 * doen alleen mee als hij de vraag "alles genoteerd?" er zelf bij beantwoordde:
 * anders stond na het aanzetten meteen de hele geschiedenis klaar.
 */
export function pendingForEbird(sessions: Session[], since: number | undefined): Session[] {
  return sessions.filter(
    (s) =>
      s.status === 'ended' &&
      (s.readyAt || s.exportedAt) &&
      !s.ebirdExportedAt &&
      !s.checklist?.skipEbird &&
      (s.checklist?.complete !== undefined ||
        (since !== undefined && (s.endedAt ?? s.startedAt) >= since)),
  );
}

export interface EbirdExport {
  file: Blob;
  filename: string;
  sessions: Session[];
  /** De waarnemingen in het bestand (opgeteld per soort) */
  exported: Observation[];
  /** Regels in het bestand: één per soort per sessie */
  rows: number;
  /** Uitgevinkt bij het nalopen */
  excluded: Observation[];
  /** Andere dieren dan vogels: eBird neemt alleen vogels */
  notBirds: Observation[];
  /** Afgeschermd of onder embargo: eBird kent dat niet en maakt alles openbaar */
  shielded: Observation[];
  /** Waarom het (nog) niet kan; leeg = klaar om te exporteren */
  problems: string[];
  /** Kan wel, maar de gebruiker moet het weten */
  warnings: string[];
}

/** Eén bestand voor een of meer sessies (eBird neemt tot 1 MB per bestand). */
export async function buildEbirdExport(sessions: Session[]): Promise<EbirdExport> {
  sessions = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const rows: Row[] = [];
  const exported: Observation[] = [];
  const excluded: Observation[] = [];
  const notBirds: Observation[] = [];
  const shielded: Observation[] = [];
  const today = isoDate(new Date());
  const problems: string[] = [];
  const warnings: string[] = [];
  const several = sessions.length > 1;

  for (const session of sessions) {
    const prefix = several
      ? t('ebirdExport.sessionPrefix', {
          name: session.place?.name ?? t('ebirdExport.defaultSessionName'),
        })
      : '';
    const observations = (await listObservations(session.id)).sort(
      (a, b) => a.observedAt - b.observedAt || a.createdAt - b.createdAt,
    );
    excluded.push(...observations.filter((obs) => obs.skipExport));
    let included = observations.filter((obs) => !obs.skipExport && getSpecies(obs.speciesId));
    notBirds.push(...included.filter((obs) => groupOf(obs.speciesId) !== BIRDS));
    included = included.filter((obs) => groupOf(obs.speciesId) === BIRDS);
    shielded.push(...included.filter((obs) => isShielded(obs, today)));
    included = included.filter((obs) => !isShielded(obs, today));
    if (included.length === 0) continue;

    const checklist = resolveChecklist(session);
    // Een losse waarneming (Incidental) is nooit een volledige lijst
    if (checklist.complete === undefined && checklist.protocol !== 'Incidental') {
      problems.push(t('ebirdExport.needComplete', { prefix }));
    }
    if (checklist.protocol === 'Traveling' && checklist.distanceM === undefined) {
      problems.push(t('ebirdExport.needDistance', { prefix }));
    }
    if (checklist.protocol === 'Traveling' && (checklist.distanceM ?? 0) > LONG_TRAVELING_M) {
      warnings.push(t('ebirdExport.long', { prefix }));
    }
    if (
      session.endedAt &&
      isoDate(new Date(session.endedAt)) !== isoDate(new Date(session.startedAt))
    ) {
      warnings.push(t('ebirdExport.midnight', { prefix }));
    }

    const location = await checklistLocation(session, included);
    for (const group of bySpecies(included)) {
      rows.push(toRow(session, checklist, location, group));
    }
    exported.push(...included);
  }

  const uncertain = exported.filter((obs) => obs.uncertain).length;
  if (uncertain > 0) {
    warnings.push(t('ebirdExport.uncertain', { n: uncertain }));
  }
  return {
    file: toCsv(rows),
    filename: `${filename(sessions)}.csv`,
    sessions,
    exported,
    rows: rows.length,
    excluded,
    notBirds,
    shielded,
    problems,
    warnings,
  };
}

/**
 * Exporteren vanuit het scherm: problemen melden, waarschuwen, opslaan en
 * markeren. Geeft de uitkomst als tekst terug, of niets als de gebruiker annuleert.
 */
export async function exportForEbird(sessions: Session[]): Promise<string | undefined> {
  const result = await buildEbirdExport(sessions);
  if (result.problems.length) return [t('ebirdExport.notReady'), ...result.problems].join(' ');
  if (result.rows === 0) return t('ebirdExport.none');
  const earlier = result.sessions.filter((s) => s.ebirdExportedAt).length;
  const warnings = [
    ...result.warnings,
    earlier > 0 &&
      (sessions.length === 1
        ? t('ebirdExport.earlierThis')
        : t('ebirdExport.earlierSome', { n: earlier })),
  ].filter(Boolean);
  if (warnings.length && !confirm([...warnings, t('export.continue')].join('\n\n'))) return;

  let saved;
  try {
    saved = await saveFile(result.file, result.filename);
    if (!saved) return;
  } catch (error) {
    logEvent('export_failed', { error: String(error), target: 'ebird' });
    return t('export.saveFailed', {
      error: errorText(error),
    });
  }
  const ebirdExportedAt = Date.now();
  await db.sessions.bulkUpdate(
    result.sessions.map((s) => ({ key: s.id, changes: { ebirdExportedAt } })),
  );
  // Regels zijn per soort per sessie; dezelfde soort in twee sessies is één soort
  const n = new Set(result.exported.map((obs) => getSpecies(obs.speciesId)!.scientific)).size;
  return [
    t('ebirdExport.done', { n }),
    saved.folder && t('export.savedIn', { folder: saved.folder }),
    result.excluded.length && t('export.excluded', { n: result.excluded.length }),
    result.notBirds.length && t('ebirdExport.notBirds', { n: result.notBirds.length }),
    result.shielded.length && t('ebirdExport.shielded', { n: result.shielded.length }),
  ]
    .filter(Boolean)
    .join(' ');
}

interface Location {
  name: string;
  lat?: number;
  lon?: number;
}

/**
 * eBird wil één plek per checklist: die van de eerste waarneming met een
 * positie, anders die van de eerste uitspraak (bij de start). Met de hand
 * of met de stem verzette plekken tellen ook: dat is waar de vogel was.
 */
async function checklistLocation(session: Session, observations: Observation[]): Promise<Location> {
  let position = observations.find((obs) => obs.position)?.position;
  if (!position) {
    const utterances = (await listUtterances(session.id)).sort(
      (a, b) => a.recordedAt - b.recordedAt,
    );
    position = utterances.find((u) => u.position)?.position;
  }
  return { name: session.place?.name ?? 'Fluistervink', lat: position?.lat, lon: position?.lon };
}

/**
 * Naam van de soort bij eBird ("Northern Lapwing", "duck sp."), of leeg als
 * die niet te koppelen was
 */
export function ebirdName(speciesId: number): string {
  const s = getSpecies(speciesId);
  return (s && (ebirdNames as Record<string, string>)[s.id]) ?? '';
}

/** Waarnemingen per soort, in de volgorde waarin de soort voor het eerst gezien is */
function bySpecies(observations: Observation[]): Observation[][] {
  const groups = new Map<string, Observation[]>();
  for (const obs of observations) {
    const scientific = getSpecies(obs.speciesId)!.scientific;
    groups.set(scientific, [...(groups.get(scientific) ?? []), obs]);
  }
  return [...groups.values()];
}

function toRow(
  session: Session,
  checklist: ResolvedChecklist,
  location: Location,
  group: Observation[],
): Row {
  const [genus, ...species] = getSpecies(group[0].speciesId)!.scientific.split(' ');
  const start = new Date(session.startedAt);
  const count = group.reduce((sum, obs) => sum + obs.count, 0);
  const incidental = checklist.protocol === 'Incidental';
  const traveling = checklist.protocol === 'Traveling';
  return {
    'Common Name': clean(ebirdName(group[0].speciesId)),
    Genus: genus,
    Species: species.join(' '),
    Number: group.some((obs) => obs.countingMethodId === NOT_COUNTED)
      ? 'X'
      : String(Math.min(MAX_COUNT, count)),
    'Species Comments': speciesComments(group),
    'Location Name': clean(location.name),
    Latitude: location.lat?.toFixed(6) ?? '',
    Longitude: location.lon?.toFixed(6) ?? '',
    Date: `${pad(start.getMonth() + 1)}/${pad(start.getDate())}/${start.getFullYear()}`,
    'Start Time': `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    // Leeg: bij de import wijs je de plek toch aan op de kaart
    'State/Province': '',
    'Country Code': countryCode(location.lat, location.lon),
    Protocol: checklist.protocol,
    'Number of Observers': String(checklist.observers),
    Duration: incidental ? '' : String(checklist.durationMin),
    // Incidental kan bij eBird niet volledig zijn, ook als de vraag "ja" was
    'All observations reported?': checklist.complete && !incidental ? 'Y' : 'N',
    'Effort Distance Miles': traveling
      ? Math.max(0.01, (checklist.distanceM ?? 0) / METERS_PER_MILE).toFixed(2)
      : '',
    'Effort area acres': '',
    'Submission Comments': CHECKLIST_COMMENT,
  };
}

/**
 * Gedrag, methode en opmerking per waarneming, zodat de optelling te volgen
 * blijft: "3 overvliegend; 1 zingend gehoord". Leeg als er niets bij staat.
 */
function speciesComments(group: Observation[]): string {
  const parts = group.map((obs) => {
    const method = methodName(obs.speciesId, obs.methodId);
    return [
      activityName(obs.speciesId, obs.activityId),
      method !== 'onbekend' && method,
      obs.remarks && `(${obs.remarks})`,
    ]
      .filter(Boolean)
      .join(' ');
  });
  if (parts.every((part) => !part)) return '';
  return clean(
    group
      .map((obs, i) =>
        [obs.countingMethodId === NOT_COUNTED ? 'niet geteld' : obs.count, parts[i]]
          .filter(Boolean)
          .join(' '),
      )
      .join('; '),
  ).slice(0, 4000);
}

/** eBird neemt geen aanhalingstekens en geen regeleindes, en splitst op elke komma */
export function clean(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replaceAll(',', ';')
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCsv(rows: Row[]): Blob {
  const lines = rows.map((row) => COLUMNS.map((column) => row[column]).join(','));
  return new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

function filename(sessions: Session[]): string {
  const first = new Date(sessions[0].startedAt);
  if (sessions.length === 1) return `ebird-${fileTimestamp(first)}`;
  const last = new Date(sessions[sessions.length - 1].startedAt);
  const days = [isoDate(first), isoDate(last)];
  return `ebird-${days[0] === days[1] ? days[0] : days.join('-tot-')}-${sessions.length}-sessies`;
}
