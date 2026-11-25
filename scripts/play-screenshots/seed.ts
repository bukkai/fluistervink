// Voorbeeldgegevens voor de schermafbeeldingen in Google Play
// (scripts/play-screenshots/run.mjs). Verzonnen, maar zoals een echte ochtend
// in de duinen in november: geen echte plekken van gebruikers. Draait in de
// browser, in de dev-server van de app, met de eigen database van de app.

import { db, type Observation, type Session, type Utterance } from '../../src/lib/db';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Gedrag en methode zoals waarneming.nl ze nummert (data/attributen-vogels.json) */
const TER_PLAATSE = 1;
const FOERAGEREND = 2;
const ROEPEND = 3;
const ZINGEND = 4;
const OVERVLIEGEND = 6;
const GEZIEN = 48;
const GEHOORD = 49;

const SPECIES = {
  houtduif: 120,
  vink: 193,
  roodborst: 168,
  kramsvogel: 143,
  koperwiek: 141,
  grotebontespecht: 109,
  buizerd: 82,
  staartmees: 181,
  kuifmees: 145,
  koolmees: 140,
  kolgans: 139,
  goudhaan: 99,
  winterkoning: 199,
  sperwer: 178,
  gaai: 92,
  pimpelmees: 161,
  merel: 150,
  boomkruiper: 71,
  sijs: 174,
  grauwegans: 104,
  spreeuw: 180,
  graspieper: 103,
  veldleeuwerik: 192,
  keep: 127,
};

interface Spoken {
  /** Minuten na de start */
  at: number;
  text: string;
  species: keyof typeof SPECIES;
  count: number;
  activity?: number;
  method?: number;
  uncertain?: string;
  /** Stappen langs de route, in meters noord en oost van de start */
  north: number;
  east: number;
}

/** Een ochtend vogelen, in de volgorde waarin het ingesproken werd */
// prettier-ignore
const MORNING: Spoken[] = [
  { at: 2, text: 'Zes overvliegende houtduiven.', species: 'houtduif', count: 6, activity: OVERVLIEGEND, north: 0, east: 20 },
  { at: 5, text: 'Roepje vink.', species: 'vink', count: 1, activity: ROEPEND, method: GEHOORD, north: 60, east: 40 },
  { at: 9, text: 'Roodborst zingend.', species: 'roodborst', count: 1, activity: ZINGEND, method: GEHOORD, north: 140, east: 70 },
  { at: 14, text: 'Groepje van twaalf kramsvogels overvliegend.', species: 'kramsvogel', count: 12, activity: OVERVLIEGEND, north: 230, east: 90 },
  { at: 18, text: 'Grote bonte specht, roepend.', species: 'grotebontespecht', count: 1, activity: ROEPEND, method: GEHOORD, north: 310, east: 140 },
  { at: 23, text: 'Drie staartmezen.', species: 'staartmees', count: 3, activity: FOERAGEREND, north: 380, east: 220 },
  { at: 27, text: 'Kuifmees in de dennen.', species: 'kuifmees', count: 1, activity: TER_PLAATSE, north: 430, east: 300 },
  { at: 31, text: 'Vijftig kolganzen overvliegend.', species: 'kolgans', count: 50, activity: OVERVLIEGEND, north: 470, east: 390 },
  { at: 36, text: 'Twee goudhaantjes.', species: 'goudhaan', count: 2, activity: FOERAGEREND, north: 520, east: 470 },
  { at: 40, text: 'Buizerd cirkelend, vijfhonderd meter zuid van hier.', species: 'buizerd', count: 1, activity: OVERVLIEGEND, north: 560, east: 540 },
  { at: 45, text: 'Winterkoning alarmerend.', species: 'winterkoning', count: 1, activity: ROEPEND, method: GEHOORD, north: 600, east: 610 },
  { at: 51, text: 'Acht koperwieken.', species: 'koperwiek', count: 8, activity: OVERVLIEGEND, north: 650, east: 700 },
];

/** Een andere ochtend, met twee waarnemingen waar de app aan twijfelde */
// prettier-ignore
const YESTERDAY: Spoken[] = [
  { at: 3, text: 'Vier pimpelmezen.', species: 'pimpelmees', count: 4, activity: FOERAGEREND, north: 0, east: 30 },
  { at: 8, text: 'Misschien een sperwer, laag over het pad.', species: 'sperwer', count: 1, activity: OVERVLIEGEND, uncertain: 'Gezegd: "misschien een sperwer"', north: 90, east: 60 },
  { at: 12, text: 'Gaai roepend.', species: 'gaai', count: 1, activity: ROEPEND, method: GEHOORD, north: 170, east: 80 },
  { at: 17, text: 'Twee merels.', species: 'merel', count: 2, activity: FOERAGEREND, north: 240, east: 130 },
  { at: 22, text: 'Kuifmees.', species: 'kuifmees', count: 1, activity: TER_PLAATSE, uncertain: 'Verstaan: "kuifmees". Kort en in de wind: kan ook koolmees zijn', north: 300, east: 210 },
  { at: 26, text: 'Boomkruiper zingend.', species: 'boomkruiper', count: 1, activity: ZINGEND, method: GEHOORD, north: 350, east: 290 },
  { at: 31, text: 'Vijf sijzen overvliegend.', species: 'sijs', count: 5, activity: OVERVLIEGEND, north: 410, east: 350 },
  { at: 37, text: 'Honderdtwintig grauwe ganzen overvliegend.', species: 'grauwegans', count: 120, activity: OVERVLIEGEND, north: 470, east: 420 },
  { at: 42, text: 'Roodborst.', species: 'roodborst', count: 1, activity: TER_PLAATSE, north: 520, east: 500 },
];

/** Hoe ver de stappen uit elkaar liggen: zo vallen ze op de kaart niet samen */
const STRETCH = 3;

/** Meters naar graden, rond 52° noorderbreedte */
function offset(start: { lat: number; lon: number }, north: number, east: number) {
  north *= STRETCH;
  east *= STRETCH;
  return {
    lat: start.lat + north / 111_320,
    lon: start.lon + east / (111_320 * Math.cos((start.lat * Math.PI) / 180)),
  };
}

function build(
  session: Session,
  spoken: Spoken[],
  start: { lat: number; lon: number },
  area: { id: number; name: string },
  status: Observation['status'],
) {
  const utterances: Utterance[] = [];
  const observations: Observation[] = [];
  for (const s of spoken) {
    const at = session.startedAt + s.at * MINUTE;
    const position = { ...offset(start, s.north, s.east), accuracy: 6 + (s.at % 7), fixedAt: at };
    const utteranceId = crypto.randomUUID();
    const observationId = crypto.randomUUID();
    utterances.push({
      id: utteranceId,
      sessionId: session.id,
      recordedAt: at,
      savedAt: at,
      audioDurationMs: 2500,
      status: 'done',
      position,
      area,
      transcript: s.text,
      result: 'observation',
      changes: [{ type: 'add', observationId }],
    } as Utterance);
    observations.push({
      id: observationId,
      sessionId: session.id,
      utteranceId,
      speciesId: SPECIES[s.species],
      count: s.count,
      countingMethodId: 2,
      activityId: s.activity ?? TER_PLAATSE,
      methodId: s.method ?? GEZIEN,
      observedAt: at,
      createdAt: at + 2000,
      position,
      area,
      uncertain: !!s.uncertain,
      uncertainReason: s.uncertain,
      status,
    });
  }
  return { utterances, observations };
}

/** Wist de database en zet de voorbeeldgegevens erin. Geeft de id's terug. */
export async function seed(now = Date.now()) {
  await Promise.all(db.tables.map((table) => table.clear()));

  const today = new Date(now);
  today.setHours(8, 10, 0, 0);
  const start = today.getTime();

  const awd = { lat: 52.3305, lon: 4.5655 };
  const awdArea = { id: 3366, name: 'Amsterdamse Waterleidingduinen' };
  const kennemer = { lat: 52.4218, lon: 4.5852 };
  const kennemerArea = { id: 1408, name: 'Nationaal Park Zuid-Kennemerland' };

  // Net bezig, anders stopt de app hem bij het openen (checkStaleSession)
  const active: Session = {
    id: crypto.randomUUID(),
    startedAt: now - 55 * MINUTE,
    status: 'active',
    place: { ...pick(awdArea), source: 'start' },
  };
  const review: Session = {
    id: crypto.randomUUID(),
    startedAt: start - DAY,
    endedAt: start - DAY + 48 * MINUTE,
    status: 'ended',
    place: { ...pick(kennemerArea), source: 'walk' },
  };
  const ready: Session = {
    id: crypto.randomUUID(),
    startedAt: start - 3 * DAY + 30 * MINUTE,
    endedAt: start - 3 * DAY + 95 * MINUTE,
    status: 'ended',
    readyAt: start - 3 * DAY + 4 * 60 * MINUTE,
    place: { ...pick(awdArea), source: 'walk' },
  };
  const exported: Session = {
    id: crypto.randomUUID(),
    startedAt: start - 8 * DAY,
    endedAt: start - 8 * DAY + 70 * MINUTE,
    status: 'ended',
    readyAt: start - 8 * DAY + 3 * 60 * MINUTE,
    exportedAt: start - 7 * DAY,
    place: { ...pick(kennemerArea), source: 'walk' },
  };

  // In het voorjaar al gezien: anders is in november alles "nieuw dit jaar"
  const spring: Session = {
    id: crypto.randomUUID(),
    startedAt: new Date(today.getFullYear(), 3, 12, 7, 30).getTime(),
    endedAt: new Date(today.getFullYear(), 3, 12, 9, 0).getTime(),
    status: 'ended',
    readyAt: new Date(today.getFullYear(), 3, 12, 12, 0).getTime(),
    exportedAt: new Date(today.getFullYear(), 3, 13, 20, 0).getTime(),
    place: { ...pick(awdArea), source: 'walk' },
  };
  const springSpecies = [...MORNING, ...YESTERDAY].filter((s) => s.species !== 'sperwer');

  const parts = [
    build(spring, springSpecies, awd, awdArea, 'exported'),
    build(active, MORNING, awd, awdArea, 'draft'),
    build(review, YESTERDAY, kennemer, kennemerArea, 'draft'),
    build(ready, MORNING.slice(0, 9), awd, awdArea, 'reviewed'),
    build(exported, YESTERDAY.slice(2), kennemer, kennemerArea, 'exported'),
  ];
  await db.sessions.bulkAdd([spring, active, review, ready, exported]);
  await db.utterances.bulkAdd(parts.flatMap((p) => p.utterances));
  await db.observations.bulkAdd(parts.flatMap((p) => p.observations));
  return { active: active.id, review: review.id, ready: ready.id, exported: exported.id };
}

/** Een trektelling op een duintop: stukken van ongeveer een minuut, elk met wat er langskwam */
// prettier-ignore
const COUNT: { at: number; text: string; birds: [keyof typeof SPECIES, number][] }[] = [
  { at: 4, text: 'Vink, achttien. Twee kepen erbij.', birds: [['vink', 18], ['keep', 2]] },
  { at: 9, text: 'Spreeuwen, vijfendertig.', birds: [['spreeuw', 35]] },
  { at: 13, text: 'Graspieper, drie.', birds: [['graspieper', 3]] },
  { at: 18, text: 'Veertig vinken.', birds: [['vink', 40]] },
  { at: 22, text: 'Veldleeuwerik, twee. Kramsvogels, vijftien.', birds: [['veldleeuwerik', 2], ['kramsvogel', 15]] },
  { at: 27, text: 'Zestig houtduiven.', birds: [['houtduif', 60]] },
  { at: 31, text: 'Sijzen, twaalf.', birds: [['sijs', 12]] },
  { at: 36, text: 'Koperwieken, vijfentwintig.', birds: [['koperwiek', 25]] },
  { at: 41, text: 'Vink, zesentwintig, en één keep.', birds: [['vink', 26], ['keep', 1]] },
];

/**
 * Een lopende sessie met een trektelling van 47 minuten. Het script zet daarna
 * de stand van de telling zelf (trektelRecorder), zonder microfoon: zo gaat er
 * niets naar spraakherkenning of model. Geeft de id van de sessie terug.
 */
export async function seedTrektel(now = Date.now()) {
  const area = { id: 3366, name: 'Amsterdamse Waterleidingduinen' };
  const spot = { lat: 52.3487, lon: 4.5961 };
  const session: Session = {
    id: crypto.randomUUID(),
    startedAt: now - 50 * MINUTE,
    status: 'active',
    place: { ...pick(area), source: 'start' },
  };
  const countStart = session.startedAt + 3 * MINUTE;
  const utterances: Utterance[] = [];
  const observations: Observation[] = [];
  for (const chunk of COUNT) {
    const at = countStart + chunk.at * MINUTE;
    const position = { ...spot, accuracy: 4, fixedAt: at - MINUTE };
    const utteranceId = crypto.randomUUID();
    const ids = chunk.birds.map(() => crypto.randomUUID());
    utterances.push({
      id: utteranceId,
      sessionId: session.id,
      recordedAt: at - MINUTE,
      savedAt: at,
      audioDurationMs: 60_000,
      status: 'done',
      trektel: true,
      position,
      area,
      transcript: chunk.text,
      result: 'observation',
      changes: ids.map((observationId) => ({ type: 'add', observationId })),
    } as Utterance);
    chunk.birds.forEach(([species, count], i) =>
      observations.push({
        id: ids[i],
        sessionId: session.id,
        utteranceId,
        speciesId: SPECIES[species],
        count,
        countingMethodId: 2,
        activityId: OVERVLIEGEND,
        methodId: GEZIEN,
        observedAt: at - MINUTE - i * 1000,
        createdAt: at + 2000,
        position,
        area,
        uncertain: false,
        status: 'draft',
      }),
    );
  }
  await db.sessions.add(session);
  await db.utterances.bulkAdd(utterances);
  await db.observations.bulkAdd(observations);
  return { session: session.id, countStart };
}

function pick(area: { id: number; name: string }) {
  return { name: area.name, areaId: area.id };
}
