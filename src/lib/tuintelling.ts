import { db, type Observation, type Session } from './db';
import { BIRDS, activityName, getSpecies, groupOf, speciesLabel } from './vocab';

// Tuintelling voor de Nationale Tuinvogeltelling van Vogelbescherming
// (docs/plan-tuintelling.md). Een gewone sessie met een vlag: je telt een half
// uur in de trektelstand (de microfoon blijft aan), en daarna rekent de app per
// soort het hoogste aantal uit dat je in één keer noemde. Het half uur begint
// pas als je begint met tellen, niet bij het starten van de sessie: wie de
// telefoon klaarzet, begint vaak pas bij de eerste vogel (feedback 22 nov). Dat geef je zelf door bij Vogelbescherming; de app stuurt hun
// niets (ze hebben geen import of API). De waarnemingen zelf blijven gewoon
// staan, dus nalopen en de export naar waarneming.nl werken zoals altijd.

/** Een tuintelling duurt een half uur */
export const TUINTEL_MS = 30 * 60_000;
/** Zo lang voor het eind een waarschuwing (tril) */
export const TUINTEL_WARN_MS = 5 * 60_000;

/**
 * Voor iedereen, rond het telweekend? Tot stap 5 van het plan (begin januari)
 * alleen de eigenaar, met de ontwikkeloptie. Op `true` zetten is de lancering:
 * dan verschijnt de knop vanzelf een week voor het telweekend en verdwijnt hij
 * na zondag (webcode, geen nieuwe app-versie nodig).
 */
export const TUINTEL_FOR_EVERYONE = false;

/**
 * Het telweekend van 2027: vrijdag 29 t/m zondag 31 januari, in de tijd van de
 * telefoon. Ieder jaar bijwerken (docs/plan-tuintelling.md, De telling).
 */
export const TELWEEKEND = {
  /** Vanaf hier de knop: een week ervoor, om alvast te proberen */
  buttonFrom: new Date(2027, 0, 22).getTime(),
  /** Vrijdag 0:00: het telweekend begint, met de melding op het startscherm */
  from: new Date(2027, 0, 29).getTime(),
  /** Maandag 0:00: het telweekend is voorbij, knop en melding weg */
  until: new Date(2027, 1, 1).getTime(),
};

/**
 * Kan de tuintelling nu? Altijd met de ontwikkeloptie (de eigenaar); voor
 * iedereen pas na de lancering, en dan alleen rond het telweekend. Zo hoeft er
 * buiten januari niets permanent bij op het startscherm (plan, punt 12).
 */
export function tuintelAvailable(
  now: number,
  devOption: boolean,
  forEveryone = TUINTEL_FOR_EVERYONE,
): boolean {
  if (devOption) return true;
  return forEveryone && now >= TELWEEKEND.buttonFrom && now < TELWEEKEND.until;
}

/** Is het nu het telweekend (vrijdag t/m zondag)? */
export function isTelweekend(at: number): boolean {
  return at >= TELWEEKEND.from && at < TELWEEKEND.until;
}

const NOTICE_KEY = `fluistervink.tuintelMelding.${new Date(TELWEEKEND.from).getFullYear()}`;

/**
 * De melding "Dit weekend is de tuintelling" op het startscherm: in het
 * telweekend, als de tuintelling kan, tot je hem wegtikt of dit weekend al een
 * tuintelling deed. Alleen in de app; er zijn geen pushberichten.
 */
export function showTelweekendNotice(
  now: number,
  available: boolean,
  sessions: readonly Pick<Session, 'tuintelling' | 'startedAt'>[],
): boolean {
  if (!available || !isTelweekend(now) || telweekendNoticeDismissed()) return false;
  return !sessions.some((s) => s.tuintelling && isTelweekend(s.startedAt));
}

export function telweekendNoticeDismissed(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissTelweekendNotice(): void {
  try {
    localStorage.setItem(NOTICE_KEY, '1');
  } catch {
    // Geblokkeerde opslag: dan alleen tot de app opnieuw opent (Home onthoudt het)
  }
}

/** Het telformulier van Vogelbescherming (web-app MijnTuinvogeltelling) */
export const TUINTEL_FORM_URL = 'https://www.mijntuinvogeltelling.nl/';

/**
 * De vaste soorten van het telformulier, in hun volgorde (de papieren tellijst,
 * op alfabet) en met hun naam; de ID's zijn die van waarneming.nl. Andere
 * soorten voeg je in het formulier toe met "vogelsoort toevoegen". Nagegaan op
 * 20 nov 2026 met de tellijst van 2026; in januari nakijken of het formulier
 * van 2027 dezelfde volgorde heeft.
 */
export const TUINTEL_FORM_SPECIES: readonly { id: number; name: string }[] = [
  { id: 70, name: 'Boomklever' },
  { id: 71, name: 'Boomkruiper' },
  { id: 87, name: 'Ekster' },
  { id: 92, name: 'Gaai' },
  { id: 261771, name: 'Groenling' },
  { id: 109, name: 'Grote bonte specht' },
  { id: 116, name: 'Halsbandparkiet' },
  { id: 118, name: 'Heggenmus' },
  { id: 120, name: 'Houtduif' },
  { id: 122, name: 'Huismus' },
  { id: 126, name: 'Kauw' },
  { id: 140, name: 'Koolmees' },
  { id: 141, name: 'Koperwiek' },
  { id: 143, name: 'Kramsvogel' },
  { id: 150, name: 'Merel' },
  { id: 161, name: 'Pimpelmees' },
  { id: 168, name: 'Roodborst' },
  { id: 180, name: 'Spreeuw' },
  { id: 181, name: 'Staartmees' },
  { id: 80199, name: 'Stadsduif' },
  { id: 191, name: 'Turkse tortel' },
  { id: 193, name: 'Vink' },
  { id: 199, name: 'Winterkoning' },
  { id: 204, name: 'Zanglijster' },
  { id: 208, name: 'Zwarte kraai' },
];

export interface TuintelLine {
  speciesId: number;
  /** Naam op het scherm */
  name: string;
  /** Naam voor het formulier van Vogelbescherming (Nederlands) */
  formName: string;
  /** Het hoogste aantal in één waarneming */
  count: number;
  /** Minstens één waarneming van deze soort is nog onzeker */
  uncertain: boolean;
}

export interface TuintelResult {
  /** Vaste soorten van het formulier die je zag, in de volgorde van het formulier */
  form: TuintelLine[];
  /** Andere soorten ("vogelsoort toevoegen"), op naam */
  extra: TuintelLine[];
  /** Verzamelsoorten ("Mees onbekend"): niet in te vullen, eerst een soort kiezen */
  unknown: TuintelLine[];
  /** Alleen overvliegend gezien: telt bij de tuintelling niet mee */
  flyovers: TuintelLine[];
}

/** Begin van het tellen; bij sessies van vóór 22 nov de start van de sessie */
export function tuintelStart(session: Session): number | undefined {
  if (!session.tuintelling) return undefined;
  if (session.tuintelStartedAt !== undefined) return session.tuintelStartedAt;
  const older = session.status === 'ended' || session.resumedAt !== undefined;
  return older ? session.startedAt : undefined;
}

/**
 * Hoe lang de tuintelling nog duurt (negatief: voorbij), op de klok: het half
 * uur van Vogelbescherming loopt ook door als je even stopt met luisteren.
 * Leeg zolang het tellen nog niet begonnen is.
 */
export function tuintelLeftMs(session: Session, now = Date.now()): number | undefined {
  const start = tuintelStart(session);
  return start === undefined ? undefined : TUINTEL_MS - (now - start);
}

/**
 * Waar een tuintelsessie is: nog niet begonnen met tellen, aan het tellen,
 * of na afloop voortgezet om nog iets in te spreken dat je vergat ("nog iets
 * vergeten?"). Leeg bij een gewone sessie.
 */
export function tuintelPhase(
  session: Session,
  now = Date.now(),
): 'before' | 'counting' | 'after' | undefined {
  const start = tuintelStart(session);
  if (!session.tuintelling) return undefined;
  if (start === undefined) return 'before';
  const end = start + TUINTEL_MS;
  if (session.resumedAt !== undefined && session.resumedAt >= end) return 'after';
  return now < end ? 'counting' : 'after';
}

/** Het tellen begint: het half uur gaat lopen (één keer per sessie) */
export async function startTuintelCount(sessionId: string, at = Date.now()): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session?.tuintelling || session.tuintelStartedAt !== undefined) return;
    await db.sessions.update(sessionId, { tuintelStartedAt: at });
  });
}

function isFlyover(obs: Observation): boolean {
  return activityName(obs.speciesId, obs.activityId)?.startsWith('overvliegend') ?? false;
}

const formNames = new Map(TUINTEL_FORM_SPECIES.map((s) => [s.id, s.name]));
const formOrder = new Map(TUINTEL_FORM_SPECIES.map((s, i) => [s.id, i]));

/** Per soort het hoogste aantal, met de onzekerheid erbij */
function maxPerSpecies(observations: Observation[]): TuintelLine[] {
  const lines = new Map<number, TuintelLine>();
  for (const obs of observations) {
    const line = lines.get(obs.speciesId);
    if (line) {
      line.count = Math.max(line.count, obs.count);
      line.uncertain ||= obs.uncertain;
      continue;
    }
    lines.set(obs.speciesId, {
      speciesId: obs.speciesId,
      name: speciesLabel(obs.speciesId),
      formName: formNames.get(obs.speciesId) ?? getSpecies(obs.speciesId)?.name ?? '?',
      count: obs.count,
      uncertain: obs.uncertain,
    });
  }
  return [...lines.values()];
}

const byName = (a: TuintelLine, b: TuintelLine) => a.formName.localeCompare(b.formName, 'nl');

/**
 * Het tuintelresultaat: per soort het hoogste aantal tegelijk (de regel van
 * Vogelbescherming: niet optellen, dan tel je dezelfde vogel dubbel).
 * Overvliegers tellen niet mee, net als andere dieren en waarnemingen die bij
 * het nalopen zijn uitgevinkt. Een soort die je zowel overvliegend als in de
 * tuin zag, telt alleen met het aantal in de tuin.
 */
export function tuintelResult(observations: Observation[]): TuintelResult {
  const birds = observations.filter(
    (obs) => groupOf(obs.speciesId) === BIRDS && !obs.skipExport && obs.count > 0,
  );
  const inGarden = birds.filter((obs) => !isFlyover(obs));
  const counted = maxPerSpecies(inGarden);
  const seen = new Set(counted.map((line) => line.speciesId));
  const isUnknown = (line: TuintelLine) => getSpecies(line.speciesId)?.type === 'M';

  return {
    form: counted
      .filter((line) => formOrder.has(line.speciesId))
      .sort((a, b) => formOrder.get(a.speciesId)! - formOrder.get(b.speciesId)!),
    extra: counted
      .filter((line) => !formOrder.has(line.speciesId) && !isUnknown(line))
      .sort(byName),
    unknown: counted.filter(isUnknown).sort(byName),
    flyovers: maxPerSpecies(birds.filter((obs) => isFlyover(obs) && !seen.has(obs.speciesId))).sort(
      byName,
    ),
  };
}

/**
 * Tekst om over te nemen in het formulier: eerst de vaste soorten, dan de
 * soorten die je daar zelf toevoegt. Verzamelsoorten en overvliegers niet.
 */
export function tuintelText(
  result: TuintelResult,
  labels: { header: string; extraHeader: string },
): string {
  const line = (l: TuintelLine) => `${l.formName} ${l.count}`;
  const parts = [labels.header, ...result.form.map(line)];
  if (result.extra.length) parts.push('', labels.extraHeader, ...result.extra.map(line));
  return parts.join('\n');
}
