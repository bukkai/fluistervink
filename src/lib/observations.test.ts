import type Anthropic from '@anthropic-ai/sdk';
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeLockManager,
  HOUTDUIF,
  KEEP,
  REE,
  STORINGEN,
  VINK,
  VOS,
  opslagVol,
  toolResponse,
} from '../test-helpers';
import { ApiError } from './api';
import { BUIZERD_ID, lifer, tochEenBuizerd } from './eastereggs.svelte';
import { db, storeAudio, type Observation, type PositionLookup, type Utterance } from './db';
import { interpret } from './interpret';
import { fillMissingAreas, nameFromSession } from './area';
import { isAccidental, isBareNo } from './applyActions';
import {
  HAND_ACCURACY,
  changedFields,
  chooseCandidate,
  confirmObservation,
  copyObservation,
  editObservation,
  listObservations,
  placeByHand,
  placeUnplaced,
  recordedPlace,
  setSkipExport,
} from './observations';
import { migrateAudio } from './audioMigration';
import { positionLater } from './utterancePosition';
import {
  STEAL_AFTER_MS,
  onDailyLimit,
  LONG_WAIT_MS,
  onLongWait,
  onSaveFailed,
  processQueue,
  retry,
  retryNow,
  stopWaiting,
  submitRecording,
  submitText,
  waitingFor,
} from './queue';
import { gps } from './location.svelte';
import { setPreference } from './preferences';
import { UNKNOWN_PLACE_ACCURACY } from './spokenPlace';
import { distanceMeters } from './geo';
import { receiveScreenOffRecording } from './screenOff.svelte';
import { noteTrektelFix, resetTrektelPosition, startTrektelPosition } from './trektelPosition';

// De wachtrij van begin tot eind, met een nagebootst model: wat het model
// teruggeeft gaat door de echte validatie (parseResponse) en wordt echt in de
// database uitgevoerd. Zo testen we "nog drie erbij", verwijderen en
// ongedaan maken zonder API.

const model = vi.hoisted(() => ({
  /** Wat het model antwoordt, gegeven de context (nieuwste waarneming eerst) */
  respond: (_recent: Observation[]): Anthropic.Message => {
    throw new Error('geen antwoord ingesteld');
  },
}));

vi.mock('./interpret', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./interpret')>();
  return {
    ...actual,
    interpret: vi.fn(
      async (
        _transcript: string,
        recent: Observation[],
        options?: { groups?: boolean; language?: 'nl' | 'en' },
      ) => {
        const response = model.respond(recent);
        return {
          ...actual.parseResponse(response, recent, options?.groups, options?.language),
          response,
          context: '',
          contextIds: recent.map((obs) => obs.id),
          timing: { requestMs: 0 },
        };
      },
    ),
  };
});

// GPS en gebied: de positie komt binnen wanneer de test dat zegt
const gpsLookup = vi.hoisted(() => ({
  resolve: (_lookup: PositionLookup) => {},
}));
vi.mock('./location.svelte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./location.svelte')>()),
  currentPosition: () => new Promise<PositionLookup>((resolve) => (gpsLookup.resolve = resolve)),
}));
vi.mock('./area', () => ({
  attachArea: async () => false,
  fillMissingAreas: vi.fn(async () => {}),
  nameFromSession: vi.fn(async () => {}),
}));

// Aanmelden als installatie: standaard het echte, per test na te bootsen
const installer = vi.hoisted(() => ({
  register: undefined as (() => Promise<{ token: string; tester: string }>) | undefined,
}));
vi.mock('./install', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./install')>();
  return {
    ...actual,
    register: () => (installer.register ?? actual.register)(),
  };
});

const SESSION = 'sessie';
const POSITION = { lat: 52.0, lon: 5.9, accuracy: 8, fixedAt: 0 };
let clock: number;

beforeEach(() => {
  clock = Date.parse('2026-10-11T14:00:00');
  vi.mocked(interpret).mockClear();
});

/** Spreek iets in, laat het model zo antwoorden, en verwerk de wachtrij. */
async function say(
  transcript: string,
  ...calls: [name: string, input: object][]
): Promise<Utterance> {
  model.respond = () => toolResponse(...calls);
  const id = await queue(transcript);
  await processQueue();
  return (await db.utterances.get(id))!;
}

/** Zet een uitspraak in de wachtrij zonder hem te verwerken. */
async function queue(transcript: string): Promise<string> {
  const id = crypto.randomUUID();
  clock += 60_000;
  await db.utterances.add({
    id,
    sessionId: SESSION,
    recordedAt: clock,
    transcript,
    position: POSITION,
    status: 'pending',
  });
  return id;
}

describe('toevoegen', () => {
  it('maakt een waarneming met standaardwaarden, tijd en positie van de uitspraak', async () => {
    const utterance = await say('zes overvliegende houtduiven', [
      'add_observation',
      { species_name: 'Houtduif', species_id: HOUTDUIF, count: 6, activity_id: 1 },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({
      speciesId: HOUTDUIF,
      count: 6,
      methodId: 48, // gezien
      countingMethodId: 2, // exact aantal
      observedAt: utterance.recordedAt,
      position: POSITION,
      uncertain: false,
      status: 'draft',
    });
    expect(utterance).toMatchObject({ status: 'done', result: 'saved' });
    expect(utterance.changes).toEqual([{ type: 'add', observationId: obs.id }]);
  });

  it('meldt een onzekere waarneming als onzeker', async () => {
    const utterance = await say('vink of keep', [
      'add_observation',
      { species_id: VINK, count: 1, uncertain: true, uncertain_reason: 'kan ook keep zijn' },
    ]);
    expect(utterance.result).toBe('uncertain');
  });

  it('negeert een uitspraak zonder waarneming', async () => {
    const utterance = await say('mooi weer vandaag');
    expect(utterance.result).toBe('ignored');
    expect(await db.observations.count()).toBe(0);
  });
});

describe('per ongeluk opgenomen', () => {
  const audio = new Blob(['x'], { type: 'audio/webm' });

  it('herkent een opname met bijna geen tekst', () => {
    // 12 okt, broekzak: 20 s geritsel, verstaan als "Roodhalsfuut."
    expect(isAccidental({ audio, audioDurationMs: 20_442, transcript: 'Roodhalsfuut.' })).toBe(
      true,
    );
    // 12 okt, bus: 3,9 s, vrijwel zeker niet gezegd
    expect(isAccidental({ audio, audioDurationMs: 3_900, transcript: 'Bosuil' })).toBe(true);
    // Echte uitspraken: kort, ook één woord, of lang met veel tekst
    expect(isAccidental({ audio, audioDurationMs: 1_900, transcript: 'Boomklever.' })).toBe(false);
    expect(isAccidental({ audio, audioDurationMs: 4_100, transcript: 'Drie kuifmezen.' })).toBe(
      false,
    );
    expect(
      isAccidental({
        audio,
        audioDurationMs: 32_600,
        transcript:
          "KBV'tje in de struik hier. Zou misschien een blako kunnen zijn, ik hoor hem niet goed.",
      }),
    ).toBe(false);
    // Een trage lijst bij het naar de lucht kijken (Maarten, 8 nov)
    const lijst =
      'Twee houtduiven, drie overvliegende spreeuwen, kramsvogel, bonte specht, grote bonte specht, drie sijs.';
    expect(isAccidental({ audio, audioDurationMs: 45_000, transcript: lijst })).toBe(false);
    // Trektelmodus: stilte is daar al weggefilterd, pauzes zijn normaal
    expect(
      isAccidental({ audio, audioDurationMs: 60_000, transcript: 'Roodhalsfuut.', trektel: true }),
    ).toBe(false);
    // Getypt: geen opname
    expect(isAccidental({ audioDurationMs: 20_000, transcript: 'x' })).toBe(false);
    // Opname later gewist: telt nog steeds als opname (bij "Opnieuw")
    expect(
      isAccidental({ audioDeletedAt: 1, audioDurationMs: 20_442, transcript: 'Roodhalsfuut.' }),
    ).toBe(true);
  });

  it('maakt wat eruit komt onzeker, met de reden', async () => {
    model.respond = () =>
      toolResponse(['add_observation', { species_name: 'Vink', species_id: VINK, count: 1 }]);
    const id = await queue('Vink.');
    await db.utterances.update(id, { audio, audioDurationMs: 20_000 });
    await processQueue();

    const [obs] = await listObservations(SESSION);
    expect(obs.uncertain).toBe(true);
    expect(obs.uncertainReason).toContain('Per ongeluk opgenomen?');
    expect((await db.utterances.get(id))!.result).toBe('uncertain');
  });
});

describe('corrigeren', () => {
  it('"nog drie erbij" telt op bij de vorige', async () => {
    await say('twee vinken', ['add_observation', { species_id: VINK, count: 2 }]);
    await say('nog drie erbij', ['update_observation', { ref: 1, add_count: 3 }]);
    const [obs] = await listObservations(SESSION);
    expect(obs.count).toBe(5);
  });

  it('"nee, keep" maakt een onzekere waarneming zeker', async () => {
    await say('vink', [
      'add_observation',
      { species_id: VINK, count: 1, uncertain: true, uncertain_reason: 'x' },
    ]);
    await say('nee, keep in plaats van vink', ['update_observation', { ref: 1, species_id: KEEP }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: KEEP, uncertain: false });
    expect(obs.uncertainReason).toBeUndefined();
  });

  it('herkent een kale "nee" met een soortnaam', () => {
    // Jurian, 4 nov: "een waterhoen" in de wind
    expect(isBareNo('Nee, waterhoen.')).toBe(true);
    expect(isBareNo('nee, twee keepen')).toBe(true);
    expect(isBareNo('Nee, een smient')).toBe(true);
    // Echte correcties zeggen meer (uit de testset)
    expect(isBareNo('Nee, keep in plaats van vink')).toBe(false);
    expect(isBareNo('Nee, die laatste was een gaai.')).toBe(false);
    expect(isBareNo('Nee die koolmees was kuifmees')).toBe(false);
    expect(isBareNo('Nee, een smient, niet een vink.')).toBe(false);
    expect(isBareNo('Nee het was groene')).toBe(false);
    expect(isBareNo('Nee.')).toBe(false);
    expect(isBareNo('Neerstrijkend, twee vinken')).toBe(false);
    expect(isBareNo(undefined)).toBe(false);
  });

  it('kale "nee, <vogel>" voert de correctie uit, maar onzeker', async () => {
    await say('twee vinken', ['add_observation', { species_id: VINK, count: 2 }]);
    const utterance = await say('Nee, keep.', ['update_observation', { ref: 1, species_id: KEEP }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: KEEP, count: 2, uncertain: true });
    expect(obs.uncertainReason).toContain('Alleen "Nee, keep." verstaan');
    expect(obs.uncertainReason).toContain('Was 2 × Vink');
    expect(utterance.result).toBe('uncertain');
  });

  it('kale "nee" zonder andere soort blijft een gewone correctie', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('nee, twee vinken', ['update_observation', { ref: 1, count: 2 }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ count: 2, uncertain: false });
  });

  it('een ander aantal met de stem laat de twijfel staan', async () => {
    await say('fitis of tjiftjaf', [
      'add_observation',
      { species_id: VINK, count: 1, uncertain: true, uncertain_reason: 'kan ook keep zijn' },
    ]);
    await say('nog één erbij', ['update_observation', { ref: 1, add_count: 1 }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ count: 2, uncertain: true, uncertainReason: 'kan ook keep zijn' });
  });

  it('"ja, klopt" met de stem maakt hem zeker als het model dat zegt', async () => {
    await say('vink', [
      'add_observation',
      { species_id: VINK, count: 1, uncertain: true, uncertain_reason: 'x' },
    ]);
    await say('ja, dat was een vink', ['update_observation', { ref: 1, uncertain: false }]);
    const [obs] = await listObservations(SESSION);
    expect(obs.uncertain).toBe(false);
    expect(obs.uncertainReason).toBeUndefined();
  });

  it('alleen een opmerking toevoegen laat de twijfel staan', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1, uncertain: true }]);
    await say('die zat op het hek', ['update_observation', { ref: 1, remarks: 'zat op het hek' }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ remarks: 'zat op het hek', uncertain: true });
  });

  it('"die laatste weg" verplaatst hem naar de prullenbak', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('die laatste weg', ['delete_observation', { ref: 1 }]);
    expect(await db.observations.count()).toBe(0);
    const [deleted] = await db.deletedObservations.toArray();
    expect(deleted).toMatchObject({ speciesId: VINK, deletedBy: 'voice' });
  });
});

describe('easter eggs', () => {
  // De grap trilt een seconde na het opslaan (setTimeout). Met echte timers
  // viel die tril op een trage CI in een latere test ("houdt de rest van de
  // wachtrij niet op" zag een feest-tril erbij): hier weggooien.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    tochEenBuizerd.visible = false;
    lifer.visible = false;
  });

  it('de buizerd komt als een waarneming toch een buizerd blijkt', async () => {
    await say('wespendief', ['add_observation', { species_id: 349, count: 1 }]);
    await say('nee, toch een buizerd', ['update_observation', { ref: 1, species_id: BUIZERD_ID }]);
    expect(tochEenBuizerd.visible).toBe(true);
    const [obs] = await listObservations(SESSION);
    expect(obs.speciesId).toBe(BUIZERD_ID);
  });

  it('geen grap bij een gewone buizerd', async () => {
    await say('buizerd', ['add_observation', { species_id: BUIZERD_ID, count: 1 }]);
    expect(tochEenBuizerd.visible).toBe(false);
  });

  it('feest bij een lifer, met de soort erbij', async () => {
    await say('keep, een lifer!', ['add_observation', { species_id: KEEP, count: 1 }]);
    expect(lifer).toMatchObject({ visible: true, speciesId: KEEP });
  });
});

describe('plek met de hand in de review', () => {
  it('bewaart de GPS-plek en kan ernaar terug', async () => {
    await say('roepje vink', ['add_observation', { species_id: VINK, count: 1 }]);
    const [obs] = await listObservations(SESSION);

    // Twee keer verzetten: de bewaarde plek blijft die van de GPS
    let place = placeByHand(obs, obs.observedAt, 52.1, 5.1);
    place = placeByHand(place, obs.observedAt, 52.2, 5.2);
    await editObservation(obs.id, place);
    let [saved] = await listObservations(SESSION);
    expect(saved.position).toEqual({
      lat: 52.2,
      lon: 5.2,
      accuracy: HAND_ACCURACY,
      fixedAt: obs.observedAt,
    });
    expect(saved.recordedPosition).toEqual(POSITION);
    expect(saved.status).toBe('reviewed');

    await editObservation(obs.id, recordedPlace(saved));
    [saved] = await listObservations(SESSION);
    expect(saved.position).toEqual(POSITION);
    expect(saved).not.toHaveProperty('recordedPosition');
  });

  it('Huidige locatie: nauwkeurigheid van de meting, afgerond en niet beter dan met de hand', () => {
    expect(placeByHand({}, 0, 52.1, 5.1, 23.6).position?.accuracy).toBe(24);
    expect(placeByHand({}, 0, 52.1, 5.1, 3).position?.accuracy).toBe(HAND_ACCURACY);
  });

  it('Plek kiezen voor alle waarnemingen zonder plek: alleen die, gezegde plek vanaf daar', async () => {
    await say('roepje vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('houtduif', ['add_observation', { species_id: HOUTDUIF, count: 2 }]);
    await say('keep', ['add_observation', { species_id: KEEP, count: 1 }]);
    const [keep, duif, vink] = await listObservations(SESSION);
    // Vink en houtduif zonder GPS (trektelling zonder fix), de houtduif "500 m zuid"
    await db.observations.update(vink.id, { position: undefined });
    await db.observations.update(duif.id, {
      position: undefined,
      spokenPlace: { text: '500 m zuid', distanceM: 500, direction: 'Z' },
    });

    const ids = await placeUnplaced(SESSION, 52.1, 5.1, 30);
    expect(ids.sort()).toEqual([vink.id, duif.id].sort());

    const placed = await db.observations.bulkGet([vink.id, duif.id, keep.id]);
    expect(placed[0]?.position).toMatchObject({ lat: 52.1, lon: 5.1, accuracy: 30 });
    expect(placed[0]?.recordedPosition).toBeNull();
    // 500 m zuid van de gekozen plek
    expect(placed[1]?.position?.lat).toBeCloseTo(52.1 - 500 / 111_000, 3);
    expect(placed[1]?.placedByVoice).toBe(true);
    // Had al een plek: blijft staan
    expect(placed[2]?.position).toEqual(POSITION);
    // Nog een keer: niets meer zonder plek
    expect(await placeUnplaced(SESSION, 52.2, 5.2)).toEqual([]);
  });

  it('zonder GPS: terug betekent weer geen locatie', () => {
    const place = placeByHand({}, 0, 52.1, 5.1);
    expect(place.recordedPosition).toBeNull();
    expect(recordedPlace(place)).toEqual({ position: undefined, recordedPosition: undefined });
  });
});

describe('plek uit de uitspraak', () => {
  const southInput = {
    species_name: 'Buizerd',
    species_id: 82,
    count: 1,
    place_description: '500 m zuid van hier',
    place_distance_m: 500,
    place_direction: 'Z',
  };

  it('"500 m zuid": verschuift de plek, de GPS blijft bewaard, niet onzeker', async () => {
    const utterance = await say('buizerd overvliegend, 500 m zuid van hier', [
      'add_observation',
      southInput,
    ]);
    const [obs] = await listObservations(SESSION);
    expect(distanceMeters(POSITION, obs.position!)).toBeCloseTo(500, -1);
    expect(obs.position!.lat).toBeLessThan(POSITION.lat);
    expect(obs.position!.accuracy).toBe(150);
    expect(obs).toMatchObject({ recordedPosition: POSITION, placedByVoice: true });
    expect(utterance.result).toBe('saved');

    // Terug naar de opgenomen plek in de review
    await editObservation(obs.id, recordedPlace(obs));
    const [back] = await listObservations(SESSION);
    expect(back.position).toEqual(POSITION);
    expect(back).not.toHaveProperty('placedByVoice');
  });

  it('"aan de overkant van de rivier": ruimere plek, onzeker om op de kaart te zetten', async () => {
    const utterance = await say('blauwe reiger aan de overkant van de rivier', [
      'add_observation',
      { species_id: VINK, count: 1, place_description: 'aan de overkant van de rivier' },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs.position).toMatchObject({ lat: POSITION.lat, accuracy: UNKNOWN_PLACE_ACCURACY });
    expect(obs.uncertain).toBe(true);
    expect(obs.uncertainReason).toMatch(/overkant van de rivier.*kaart/);
    expect(utterance.result).toBe('uncertain');
  });

  it('houdt de twijfel van het model en voegt de plek eraan toe', async () => {
    await say('vink of keep, ergens daar', [
      'add_observation',
      {
        species_id: VINK,
        count: 1,
        uncertain: true,
        uncertain_reason: 'kan ook keep zijn',
        place_description: 'ergens daar',
      },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs.uncertainReason).toMatch(/^kan ook keep zijn; Plek gezegd: "ergens daar"/);
  });

  it('later een plek die wel uit te rekenen is: de twijfel over de oude plek gaat eraf', async () => {
    await say('reiger aan de overkant van de rivier', [
      'add_observation',
      { species_id: VINK, count: 1, place_description: 'aan de overkant van de rivier' },
    ]);
    await say('die zat 300 m noord', [
      'update_observation',
      { ref: 1, place_description: '300 m noord', place_distance_m: 300, place_direction: 'N' },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs.uncertain).toBe(false);
    expect(obs.uncertainReason).toBeUndefined();
  });

  it('later een andere plek: twijfel van het model blijft, de oude plek-twijfel niet', async () => {
    await say('vink of keep, ergens daar', [
      'add_observation',
      {
        species_id: VINK,
        count: 1,
        uncertain: true,
        uncertain_reason: 'kan ook keep zijn',
        place_description: 'ergens daar',
      },
    ]);
    await say('die zat bij de boom', [
      'update_observation',
      { ref: 1, place_description: 'bij de boom' },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs.uncertain).toBe(true);
    expect(obs.uncertainReason).toBe(
      'kan ook keep zijn; Plek gezegd: "bij de boom"; zet hem op de kaart',
    );
  });

  it('later verbeterd ("die zat 300 m noord"): rekent vanaf de GPS, niet vanaf de vorige plek', async () => {
    await say('buizerd 500 m zuid', ['add_observation', southInput]);
    await say('die buizerd zat eigenlijk 300 m noord', [
      'update_observation',
      { ref: 1, place_description: '300 m noord', place_distance_m: 300, place_direction: 'N' },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(distanceMeters(POSITION, obs.position!)).toBeCloseTo(300, -1);
    expect(obs.position!.lat).toBeGreaterThan(POSITION.lat);
    expect(obs.recordedPosition).toEqual(POSITION);

    // Ongedaan maken zet de vorige plek terug
    await say('ongedaan maken', ['undo', {}]);
    const [undone] = await listObservations(SESSION);
    expect(undone.position!.lat).toBeLessThan(POSITION.lat);
    expect(undone.spokenPlace?.text).toBe('500 m zuid van hier');
  });

  it('GPS komt pas na het verwerken binnen: de plek wordt alsnog uitgerekend', async () => {
    model.respond = () => toolResponse(['add_observation', southInput]);
    await submitText(SESSION, 'buizerd 500 m zuid van hier');
    await vi.waitFor(async () => expect(await db.observations.count()).toBe(1));
    expect((await listObservations(SESSION))[0].position).toBeUndefined();

    gpsLookup.resolve({ source: 'fresh', position: POSITION, waitMs: 100 });
    await vi.waitFor(async () => {
      const [obs] = await listObservations(SESSION);
      expect(obs.position?.accuracy).toBe(150);
      expect(obs.recordedPosition).toEqual(POSITION);
    });
  });
});

describe('plek die later komt (GPS zonder fix)', () => {
  const FIX = { lat: 52.0, lon: 5.9, accuracy: 7, fixedAt: Date.parse('2026-10-11T15:00:00') };
  const none = { source: 'none' as const, waitMs: 10_000, error: 'Timeout expired' };

  async function unplaced(minutesBefore: number, extra: Partial<Utterance> = {}) {
    const id = crypto.randomUUID();
    await db.utterances.add({
      id,
      sessionId: SESSION,
      recordedAt: FIX.fixedAt - minutesBefore * 60_000,
      transcript: 'vink',
      status: 'done',
      positionLookup: none,
      ...extra,
    });
    await db.observations.add({
      id: 'obs-' + id,
      sessionId: SESSION,
      utteranceId: id,
      speciesId: VINK,
      count: 1,
      observedAt: FIX.fixedAt - minutesBefore * 60_000,
      createdAt: 0,
      uncertain: false,
      status: 'draft',
    });
    return id;
  }

  afterEach(() => {
    gps.latest = undefined;
  });

  it('eerdere uitspraken zonder plek krijgen de eerste meting alsnog', async () => {
    const trektel = await unplaced(3, { trektel: true });
    const walking = await unplaced(2);
    const tooOld = await unplaced(20);
    // Nog aan het zoeken: die krijgt zijn eigen meting
    const searching = await unplaced(1, { positionLookup: undefined });
    // Vorige sessie, vlak daarvoor gestopt: kan kilometers verderop zijn
    const otherSession = await unplaced(4, { sessionId: 'vorige-sessie' });

    await positionLater(FIX, SESSION);

    const [t, w, old, busy, other] = await db.utterances.bulkGet([
      trektel,
      walking,
      tooOld,
      searching,
      otherSession,
    ]);
    // Trektelling: je stond stil, de plek klopt
    expect(t?.position).toEqual(FIX);
    expect(t?.positionLookup).toMatchObject({ source: 'later', waitMs: 3 * 60_000 });
    // Lopend: zo ver kun je in 2 minuten zijn (1,4 m/s)
    expect(w?.position?.accuracy).toBe(7 + 168);
    expect(old?.position).toBeUndefined();
    expect(busy?.position).toBeUndefined();
    expect(other?.position).toBeUndefined();
    expect((await db.observations.get('obs-' + trektel))?.position).toEqual(FIX);
  });

  it('meting kwam net binnen terwijl het opvragen opgaf: meteen gebruikt', async () => {
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    await submitText(SESSION, 'vink');
    await vi.waitFor(async () => expect(await db.observations.count()).toBe(1));
    gps.latest = { ...FIX, fixedAt: Date.now() + 1000 };
    gpsLookup.resolve({ ...none });
    await vi.waitFor(async () => {
      const [u] = await db.utterances.toArray();
      expect(u.positionLookup?.source).toBe('later');
      expect((await listObservations(SESSION))[0].position).toMatchObject({ lat: FIX.lat });
    });
  });
});

describe('kopiëren in de review', () => {
  it('maakt een nieuwe waarneming met dezelfde tijd, plek, bron en velden', async () => {
    await say('vier wilde eenden en een winterkoning', [
      'add_observation',
      { species_id: VINK, count: 1, uncertain: true, uncertain_reason: 'x', remarks: 'op het hek' },
    ]);
    const [original] = await listObservations(SESSION);
    await editObservation(original.id, { count: 2 });
    await setSkipExport(original.id, true);

    const id = await copyObservation(original.id);
    const [copy, again] = await listObservations(SESSION);
    expect(copy.id).toBe(id);
    expect(copy.id).not.toBe(original.id);
    expect(copy).toMatchObject({
      sessionId: SESSION,
      utteranceId: original.utteranceId,
      speciesId: VINK,
      count: 2,
      remarks: 'op het hek',
      observedAt: original.observedAt,
      position: POSITION,
      uncertain: false,
      status: 'draft',
    });
    expect(copy.uncertainReason).toBeUndefined();
    expect(copy.editedAt).toBeUndefined();
    expect(copy.skipExport).toBeUndefined();
    // Het origineel blijft zoals het was
    expect(again).toMatchObject({ id: original.id, status: 'reviewed', skipExport: true });
  });

  it('doet niets bij een onbekend id', async () => {
    expect(await copyObservation('bestaat-niet')).toBeUndefined();
    expect(await db.observations.count()).toBe(0);
  });
});

describe('ongedaan maken', () => {
  it('haalt een toevoeging weg', async () => {
    const first = await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('ongedaan maken', ['undo', {}]);
    expect(await db.observations.count()).toBe(0);
    expect((await db.deletedObservations.toArray())[0].deletedBy).toBe('undo');
    expect((await db.utterances.get(first.id))?.undone).toBe(true);
  });

  it('zet een correctie terug', async () => {
    await say('twee vinken', ['add_observation', { species_id: VINK, count: 2 }]);
    await say('nee, keep', ['update_observation', { ref: 1, species_id: KEEP }]);
    await say('ongedaan maken', ['undo', {}]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: VINK, count: 2 });
  });

  it('zet een verwijderde waarneming terug', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('die laatste weg', ['delete_observation', { ref: 1 }]);
    await say('ongedaan maken', ['undo', {}]);
    expect(await db.observations.count()).toBe(1);
    expect(await db.deletedObservations.count()).toBe(0);
  });

  it('een trektelstuk maakt niets ongedaan', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    const id = crypto.randomUUID();
    await db.utterances.add({
      id,
      sessionId: SESSION,
      recordedAt: (clock += 60_000),
      transcript: 'nee, dat was fout',
      status: 'pending',
      trektel: true,
    });
    model.respond = () => toolResponse(['undo', {}]);
    await processQueue();
    expect(await listObservations(SESSION)).toHaveLength(1);
    expect((await db.utterances.get(id))!.result).toBe('ignored');
    await vi.waitFor(async () =>
      expect(await db.events.where('type').equals('undo_skipped').count()).toBe(1),
    );
  });

  it('twee keer ongedaan maken gaat twee stappen terug', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('houtduif', ['add_observation', { species_id: HOUTDUIF, count: 1 }]);
    await say('ongedaan maken', ['undo', {}]);
    await say('ongedaan maken', ['undo', {}]);
    expect(await db.observations.count()).toBe(0);
  });
});

describe('afschermen en embargo', () => {
  it('schermt een nieuwe waarneming af zonder hem onzeker te maken', async () => {
    await say('een draaihals, nest, afschermen', [
      'add_observation',
      { species_id: VINK, count: 1, obscurity: 9, embargo_until: null },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ obscurity: 9, uncertain: false });
    expect(obs.embargoUntil).toBeUndefined();
  });

  it('schermt eerdere af en laat hun twijfel staan; ongedaan maken zet het terug', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1, uncertain: true }]);
    await say('houtduif', ['add_observation', { species_id: HOUTDUIF, count: 1 }]);
    await say(
      'zet alle vorige op afgeschermd',
      ['shield_observation', { ref: 1, obscurity: 9, embargo_until: null }],
      ['shield_observation', { ref: 2, obscurity: 9, embargo_until: null }],
    );
    const [duif, vink] = await listObservations(SESSION);
    expect(duif).toMatchObject({ obscurity: 9, uncertain: false });
    expect(vink).toMatchObject({ obscurity: 9, uncertain: true });

    await say('ongedaan maken', ['undo', {}]);
    for (const obs of await listObservations(SESSION)) expect(obs.obscurity).toBeUndefined();
  });

  it('een embargo met datum bewaart de datum', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('embargo tot 1 maart', [
      'shield_observation',
      { ref: 1, obscurity: null, embargo_until: '2027-03-01' },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ embargoUntil: '2027-03-01', uncertain: false });
    expect(obs).not.toHaveProperty('embargoNoDate');
  });

  it('"zonder embargo" haalt het embargo weg; ongedaan maken zet het terug', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('die onder embargo tot 1 maart', [
      'update_observation',
      { ref: 1, obscurity: 9, embargo_until: '2027-03-01' },
    ]);
    await say('openbaar publiceren zonder embargo', [
      'update_observation',
      { ref: 1, obscurity: 0, embargo_until: 'geen' },
    ]);
    let [obs] = await listObservations(SESSION);
    expect(obs.embargoUntil).toBeUndefined();
    expect(obs).not.toHaveProperty('clearEmbargo');
    expect(obs).toMatchObject({ obscurity: 0, uncertain: false });

    await say('ongedaan maken', ['undo', {}]);
    [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ obscurity: 9, embargoUntil: '2027-03-01' });
  });

  it('"geen" embargo bij een nieuwe waarneming doet niets', async () => {
    await say('een vink zonder embargo', [
      'add_observation',
      { species_id: VINK, count: 1, obscurity: null, embargo_until: 'geen' },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs).not.toHaveProperty('clearEmbargo');
    expect(obs.embargoUntil).toBeUndefined();
  });

  it('een embargo zonder datum maakt de waarneming onzeker, met de vraag om een datum', async () => {
    await say('een vink onder embargo', [
      'add_observation',
      { species_id: VINK, count: 1, obscurity: null, embargo_until: 'zonder datum' },
    ]);
    await say('houtduif', ['add_observation', { species_id: HOUTDUIF, count: 1 }]);
    await say('die onder embargo', [
      'update_observation',
      { ref: 1, obscurity: null, embargo_until: 'zonder datum' },
    ]);
    for (const obs of await listObservations(SESSION)) {
      expect(obs).toMatchObject({
        uncertain: true,
        uncertainReason: expect.stringMatching(/embargo/i),
      });
      expect(obs.embargoUntil).toBeUndefined();
      expect(obs).not.toHaveProperty('embargoNoDate');
    }
  });
});

describe('rare aantallen en niets om te doen', () => {
  it('"nog vijf eraf" bij drie: 1, maar onzeker met de reden', async () => {
    await say('drie vinken', ['add_observation', { species_id: VINK, count: 3 }]);
    const u = await say('nog vijf eraf', ['update_observation', { ref: 1, add_count: -5 }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({
      count: 1,
      uncertain: true,
      uncertainReason: '3 − 5 kan niet: op 1 gezet',
    });
    expect(u.result).toBe('uncertain');
  });

  it('"nog twee eraf" bij vijf: gewoon drie, zeker', async () => {
    await say('vijf vinken', ['add_observation', { species_id: VINK, count: 5 }]);
    await say('twee eraf', ['update_observation', { ref: 1, add_count: -2 }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ count: 3, uncertain: false });
  });

  it('ongedaan maken zonder iets om terug te draaien: niet begrepen', async () => {
    const u = await say('ongedaan maken', ['undo', {}]);
    expect(u.result).toBe('ignored');
    expect(u.undid).toBeUndefined();
  });

  it('opnieuw doen zonder eerdere undo: niet begrepen', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    const u = await say('toch niet ongedaan maken', ['redo', {}]);
    expect(u.result).toBe('ignored');
    expect(await db.observations.count()).toBe(1);
  });

  it('"die laatste weg" in een lege sessie: niet begrepen', async () => {
    const u = await say('die laatste weg', ['delete_observation', { ref: 1 }]);
    expect(u.result).toBe('ignored');
  });

  it('een waarneming die intussen weg is aanpassen: niet begrepen', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    const [obs] = await listObservations(SESSION);
    // Het model kreeg de vink nog in de context; daarna met de hand verwijderd
    model.respond = () => toolResponse(['update_observation', { ref: 1, species_id: KEEP }]);
    const id = await queue('nee, keep');
    vi.mocked(interpret).mockImplementationOnce(async (_t, recent) => {
      const response = model.respond(recent);
      const { parseResponse } = await vi.importActual<typeof import('./interpret')>('./interpret');
      const parsed = parseResponse(response, recent);
      await db.observations.delete(obs.id);
      return { ...parsed, response, context: '', contextIds: [], timing: { requestMs: 0 } };
    });
    await processQueue();
    expect((await db.utterances.get(id))?.result).toBe('ignored');
  });

  it('een groot geschat aantal komt er gewoon in', async () => {
    await say("zo'n tweeënhalfduizend kolganzen", [
      'add_observation',
      { species_id: VINK, count: 2500 },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs.count).toBe(2500);
  });
});

describe('met de hand bewerken terwijl de stem corrigeert', () => {
  it('Opslaan overschrijft een stemcorrectie niet, alleen wat je zelf aanpaste', async () => {
    await say('twee vinken', ['add_observation', { species_id: VINK, count: 2 }]);
    // Formulier open: een kopie van de waarneming
    const [opened] = await listObservations(SESSION);
    // Intussen met de stem: "nee, keep"
    await say('nee, die laatste was een keep', [
      'update_observation',
      { ref: 1, species_id: KEEP },
    ]);
    // In het formulier alleen het aantal aangepast, dan Opslaan
    await editObservation(
      opened.id,
      changedFields(opened, { speciesId: opened.speciesId, count: 3, remarks: undefined }),
    );
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: KEEP, count: 3, status: 'reviewed' });
  });

  it('met de stem verwijderd terwijl het formulier openstond: Opslaan zegt dat', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    const [opened] = await listObservations(SESSION);
    await say('die laatste weg', ['delete_observation', { ref: 1 }]);
    expect(await editObservation(opened.id, { count: 2 })).toBe(false);
    // Niet stil teruggezet
    expect(await db.observations.count()).toBe(0);
  });

  it('changedFields vergelijkt ook plekken en lijsten op inhoud', () => {
    const position = { lat: 52, lon: 5, accuracy: 8, fixedAt: 0 };
    const original: Observation = {
      id: 'w',
      sessionId: SESSION,
      utteranceId: 'u',
      speciesId: VINK,
      count: 1,
      observedAt: 0,
      createdAt: 0,
      uncertain: true,
      candidates: [VINK, KEEP],
      position,
      status: 'draft',
    };
    expect(
      changedFields(original, {
        speciesId: VINK,
        position: { ...position },
        candidates: [VINK, KEEP],
        uncertain: false,
      }),
    ).toEqual({ uncertain: false });
  });
});

describe('telefoon vol', () => {
  it('opslaan mislukt: geen fout naar boven, wel "mislukt" en het sessiescherm hoort het', async () => {
    const vibrations: unknown[] = [];
    vi.stubGlobal('navigator', {
      ...navigator,
      vibrate: (pattern: number[]) => (vibrations.push(pattern), true),
    });
    const spy = opslagVol(db.utterances);
    const heard = vi.fn();
    const off = onSaveFailed(heard);
    try {
      await expect(submitText(SESSION, 'roepje vink')).resolves.toBeUndefined();
    } finally {
      off();
      spy.mockRestore();
      vi.unstubAllGlobals();
    }
    expect(heard).toHaveBeenCalledWith(true);
    expect(vibrations).toEqual([[120, 150, 120, 150, 120]]);
    const [event] = (await db.events.toArray()).filter((e) => e.type === 'save_failed');
    expect(event.data).toMatchObject({ full: true, trektel: false });
    expect(await db.utterances.count()).toBe(0);
  });

  it('een andere fout bij het opslaan is niet "vol"', async () => {
    const spy = vi.spyOn(db.utterances, 'add').mockRejectedValueOnce(new Error('kapot'));
    const heard = vi.fn();
    const off = onSaveFailed(heard);
    try {
      await submitText(SESSION, 'roepje vink');
    } finally {
      off();
      spy.mockRestore();
    }
    expect(heard).toHaveBeenCalledWith(false);
  });

  const noPosition = () => Promise.resolve({ source: 'none' } as never);

  it('een opname die niet bewaard kon worden, meldt dat (scherm uit laat het bestand dan staan)', async () => {
    const spy = opslagVol(db.utterances);
    const off = onSaveFailed(() => {});
    try {
      const recording = { audio: new Blob(['x']), startedAt: Date.now(), durationMs: 1000 };
      await expect(submitRecording(SESSION, recording, noPosition())).resolves.toBe(false);
    } finally {
      off();
      spy.mockRestore();
    }
    const recording = { audio: new Blob(['x']), startedAt: Date.now(), durationMs: 1000 };
    await expect(submitRecording(SESSION, recording, noPosition())).resolves.toBe(true);
  });
});

describe('Stop terwijl de wachtrij nog bezig is', () => {
  it('de laatste uitspraak telt mee voor de naam van de gestopte sessie', async () => {
    await db.sessions.add({ id: SESSION, startedAt: clock, status: 'ended', endedAt: clock + 1 });
    vi.mocked(nameFromSession).mockClear();
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    expect(await db.observations.count()).toBe(1);
    expect(nameFromSession).toHaveBeenCalledWith(SESSION);
  });

  it('een lopende sessie krijgt geen nieuwe naam per uitspraak', async () => {
    await db.sessions.add({ id: SESSION, startedAt: clock, status: 'active' });
    vi.mocked(nameFromSession).mockClear();
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    expect(nameFromSession).not.toHaveBeenCalled();
  });
});

describe('opnieuw doen', () => {
  it('zet een ongedaan gemaakte toevoeging terug', async () => {
    const first = await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    const undo = await say('ongedaan maken', ['undo', {}]);
    await say('toch niet ongedaan maken', ['redo', {}]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: VINK, count: 1 });
    expect(await db.deletedObservations.count()).toBe(0);
    expect((await db.utterances.get(first.id))?.undone).toBe(false);
    expect((await db.utterances.get(undo.id))?.undone).toBe(true);
  });

  it('zet een ongedaan gemaakte correctie en verwijdering terug', async () => {
    await say('twee vinken', ['add_observation', { species_id: VINK, count: 2 }]);
    await say('houtduif', ['add_observation', { species_id: HOUTDUIF, count: 1 }]);
    const [houtduif, vink] = await listObservations(SESSION);
    await say(
      'die vink is een keep, houtduif weg',
      ['update_observation', { ref: 2, species_id: KEEP }],
      ['delete_observation', { ref: 1 }],
    );
    await say('ongedaan maken', ['undo', {}]);
    await say('toch niet', ['redo', {}]);
    expect(await db.observations.get(vink.id)).toMatchObject({ speciesId: KEEP, count: 2 });
    expect(await db.observations.get(houtduif.id)).toBeUndefined();
    expect(await db.deletedObservations.get(houtduif.id)).toBeDefined();
  });

  it('daarna ongedaan maken draait de uitspraak weer terug', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('ongedaan maken', ['undo', {}]);
    await say('toch niet', ['redo', {}]);
    await say('ongedaan maken', ['undo', {}]);
    expect(await db.observations.count()).toBe(0);
  });

  it('doet niets zonder eerdere undo', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('toch niet', ['redo', {}]);
    expect(await db.observations.count()).toBe(1);
  });
});

describe('wachtrij', () => {
  it('feedback gaat niet naar het model', async () => {
    const utterance = await say('Feedback, de knop is te klein');
    expect(utterance).toMatchObject({ status: 'done', kind: 'dev_note', result: 'note' });
    expect(interpret).not.toHaveBeenCalled();
  });

  it('feedback tussen waarnemingen wordt een eigen uitspraak', async () => {
    const utterance = await say(
      'Zes holenduiven. Feedback, wat betekent nul stukken? Buizerd.',
      ['add_observation', { species_id: HOUTDUIF, count: 6 }],
      ['add_dev_note', { text: 'wat betekent nul stukken?' }],
      ['add_observation', { species_id: VINK, count: 1 }],
    );
    expect(utterance.kind).toBeUndefined();
    expect(utterance.result).toBe('saved');
    expect(await db.observations.count()).toBe(2);
    const notes = await db.utterances.filter((u) => u.kind === 'dev_note').toArray();
    expect(notes).toMatchObject([
      {
        transcript: 'wat betekent nul stukken?',
        sessionId: SESSION,
        fromUtteranceId: utterance.id,
        position: POSITION,
        status: 'done',
        result: 'note',
      },
    ]);
  });

  it('een trektelstuk dat met feedback begint, gaat toch naar het model', async () => {
    const id = crypto.randomUUID();
    await db.utterances.add({
      id,
      sessionId: SESSION,
      recordedAt: (clock += 60_000),
      transcript: 'Feedback, de knop is te klein. Zes houtduiven.',
      status: 'pending',
      trektel: true,
    });
    model.respond = () =>
      toolResponse(
        ['add_dev_note', { text: 'de knop is te klein' }],
        ['add_observation', { species_id: HOUTDUIF, count: 6 }],
      );
    await processQueue();
    expect(interpret).toHaveBeenCalled();
    expect(await db.observations.count()).toBe(1);
    expect(await db.utterances.get(id)).toMatchObject({ result: 'saved' });
  });

  it('verwerkt wachtende uitspraken op volgorde', async () => {
    const seen: string[] = [];
    vi.mocked(interpret).mockImplementation(async (transcript) => {
      seen.push(transcript);
      return {
        actions: [],
        rejected: [],
        warnings: [],
        response: toolResponse(),
        context: '',
        contextIds: [],
        timing: { requestMs: 0 },
      };
    });
    await queue('eerste');
    await queue('tweede');
    await queue('derde');
    await processQueue();
    expect(seen).toEqual(['eerste', 'tweede', 'derde']);
    vi.mocked(interpret).mockReset();
  });

  it('bewaart een uitspraak bij een fout, en verwerkt hem bij opnieuw proberen', async () => {
    model.respond = () => {
      throw new Error('geen verbinding');
    };
    const id = await queue('vink');
    await processQueue();
    expect(await db.utterances.get(id)).toMatchObject({
      status: 'failed',
      error: 'geen verbinding',
    });

    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    await retry(id);
    await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('done'));
    expect(await db.observations.count()).toBe(1);
  });

  it('bij opnieuw proberen ziet het model alleen wat er vóór de uitspraak was', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    model.respond = () => {
      throw new Error('geen verbinding');
    };
    const id = await queue('nog drie erbij');
    await processQueue();
    await say('houtduif', ['add_observation', { species_id: HOUTDUIF, count: 1 }]);

    let seen: Observation[] = [];
    model.respond = (recent) => {
      seen = recent;
      return toolResponse(['update_observation', { ref: 1, add_count: 3 }]);
    };
    await retry(id);
    await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('done'));
    expect(seen.map((obs) => obs.speciesId)).toEqual([VINK]);
    const counts = (await listObservations(SESSION)).map((obs) => [obs.speciesId, obs.count]);
    expect(counts).toEqual([
      [HOUTDUIF, 1],
      [VINK, 4],
    ]);
  });

  it('pakt uitspraken op die bleven hangen (app afgesloten tijdens verwerken)', async () => {
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    const id = await queue('vink');
    await db.utterances.update(id, { status: 'processing' });
    await processQueue();
    expect((await db.utterances.get(id))?.status).toBe('done');
  });

  it('mislukt na drie keer onderbroken, met de opname bewaard; opnieuw geeft weer drie kansen', async () => {
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    const id = await queue('vink');
    // Twee keer bleef hij hangen (app gecrasht tijdens het verwerken)
    await db.utterances.update(id, { status: 'processing', interrupted: 2 });
    await processQueue();
    expect(await db.utterances.get(id)).toMatchObject({
      status: 'failed',
      interrupted: 3,
      error: 'Het verwerken werd steeds onderbroken. De opname is bewaard.',
    });
    expect(interpret).not.toHaveBeenCalled();

    await retry(id);
    await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('done'));
    expect((await db.utterances.get(id))?.interrupted).toBeUndefined();
    expect(await db.observations.count()).toBe(1);
  });

  it('telt elke onderbreking, en gaat tot de derde gewoon door', async () => {
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    const id = await queue('vink');
    await db.utterances.update(id, { status: 'processing', interrupted: 1 });
    await processQueue();
    expect(await db.utterances.get(id)).toMatchObject({ status: 'done', interrupted: 2 });
  });

  it('een uitspraak die binnenkomt terwijl de wachtrij afrondt, blijft niet liggen', async () => {
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    const first = await queue('vink');
    let late: string | undefined;
    // Na de laatste uitspraak kijkt de wachtrij nog naar de sessies (naam,
    // gebieden). Precies dan een nieuwe uitspraak, die processQueue aanroept.
    const get = db.sessions.get.bind(db.sessions);
    const spy = vi.spyOn(db.sessions, 'get').mockImplementation(((key: string) => {
      const result = get(key);
      if (!late) {
        return db.utterances.get(first).then(async (u) => {
          if (u?.status === 'done' && !late) {
            late = await queue('nog een vink');
            void processQueue();
          }
          return result;
        });
      }
      return result;
    }) as typeof db.sessions.get);
    try {
      await processQueue();
    } finally {
      spy.mockRestore();
    }
    expect(late).toBeDefined();
    expect((await db.utterances.get(late!))?.status).toBe('done');
  });

  it('een uitspraak waarbij de database faalt, houdt de rest niet op', async () => {
    // Zoals Safari met een Blob uit IndexedDB (28 okt)
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    const broken = await queue('keep');
    const next = await queue('vink');
    const update = db.utterances.update.bind(db.utterances);
    const spy = vi.spyOn(db.utterances, 'update').mockImplementation((id, changes) => {
      if (id === broken) throw new Error('Error preparing Blob/File data');
      return update(id, changes);
    });
    try {
      await processQueue();
    } finally {
      spy.mockRestore();
    }
    expect((await db.utterances.get(broken))?.status).toBe('pending');
    expect((await db.utterances.get(next))?.status).toBe('done');
  });
});

describe('opnames van vóór 28 okt (Blob)', () => {
  // De Blob van happy-dom overleeft fake-indexeddb niet, die van Node wel
  async function legacy(fields: Partial<Utterance> = {}): Promise<string> {
    const id = crypto.randomUUID();
    await db.utterances.add({
      id,
      sessionId: SESSION,
      recordedAt: (clock += 60_000),
      audio: new NodeBlob(['opus'], { type: 'audio/webm' }) as Blob,
      status: 'done',
      transcript: 'vink',
      ...fields,
    });
    return id;
  }

  it('zet ze om naar bytes met het formaat', async () => {
    const id = await legacy();
    await migrateAudio();
    const audio = (await db.utterances.get(id))?.audio;
    expect(audio).toMatchObject({ type: 'audio/webm' });
    expect(new TextDecoder().decode((audio as { data: ArrayBuffer }).data)).toBe('opus');
  });

  it('een onleesbare opname gaat eruit; een wachtende uitspraak mislukt', async () => {
    const done = await legacy();
    const waiting = await legacy({ status: 'processing', transcript: undefined });
    const read = vi
      .spyOn(NodeBlob.prototype, 'arrayBuffer')
      .mockRejectedValue(new Error('NotReadable'));
    try {
      await migrateAudio();
    } finally {
      read.mockRestore();
    }
    const [a, b] = await Promise.all([db.utterances.get(done), db.utterances.get(waiting)]);
    expect(a).toMatchObject({ status: 'done' });
    expect(b).toMatchObject({ status: 'failed', error: 'Opname niet meer te lezen' });
    expect([a?.audio, b?.audio]).toEqual([undefined, undefined]);
  });
});

describe('netwerk weg', () => {
  // Een opname gaat eerst naar /api/transcribe (echte api.ts, nagebootste
  // fetch), daarna naar het (nagebootste) model.
  const audio = new Blob(['opus'], { type: 'audio/webm' });
  let vibrations: number[][];
  let transcribeCalls: number;

  beforeEach(() => {
    vibrations = [];
    transcribeCalls = 0;
    // Met een token, zodat de app zich niet eerst als installatie aanmeldt
    localStorage.setItem('fluistervink.installToken', 'i1.token-van-anna');
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      locks: undefined,
      vibrate: (pattern: number[]) => (vibrations.push(pattern), true),
    });
  });

  afterEach(() => {
    stopWaiting();
    vi.unstubAllGlobals();
  });

  /** fetch zoals een telefoon zonder bereik (of met), alleen voor /api/transcribe */
  function network(online: boolean) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        transcribeCalls++;
        if (!online) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify({ text: 'Roepje vink.' }), { status: 200 });
      }),
    );
  }

  async function record(): Promise<string> {
    const id = crypto.randomUUID();
    clock += 60_000;
    await db.utterances.add({
      id,
      sessionId: SESSION,
      recordedAt: clock,
      audio: await storeAudio(audio),
      audioDurationMs: 2_000,
      status: 'pending',
    });
    return id;
  }

  const FAILED = [120, 150, 120, 150, 120];

  const WAITING = [450, 150, 120];

  it('weg tijdens het uploaden: opname blijft bewaard en wacht op bereik', async () => {
    network(false);
    const id = await record();
    await processQueue();
    const u = await db.utterances.get(id);
    expect(u).toMatchObject({ status: 'pending', waitingSince: expect.any(Number) });
    expect(u?.audio).toBeDefined();
    expect(u?.transcript).toBeUndefined();
    expect(u?.error).toBeUndefined();
    expect(vibrations).toEqual([WAITING]);
    expect(interpret).not.toHaveBeenCalled();
  });

  it('reden van het wachten uit de code van de proxy', () => {
    expect(waitingFor(new ApiError('x', 503, 'paused'))).toBe('paused');
    expect(waitingFor(new ApiError('x', 503, 'budget'))).toBe('busy');
    // Nieuwe installatie die zich niet kan aanmelden (te veel tegelijk)
    expect(waitingFor(new ApiError('x', 503, 'install_limit'))).toBe('busy');
    expect(waitingFor(new ApiError('x', 0))).toBeUndefined();
    expect(waitingFor(new ApiError('x', 503))).toBeUndefined();
  });

  it('noodrem of dagbudget: wacht met de reden erbij, en die gaat weg als het weer gaat', async () => {
    const answers: (() => Response)[] = [
      () => Response.json({ error: 'gepauzeerd', code: 'paused' }, { status: 503 }),
      () => {
        throw new TypeError('Failed to fetch');
      },
      () => Response.json({ error: 'druk', code: 'budget' }, { status: 503 }),
      () => Response.json({ text: 'Roepje vink.' }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => answers.shift()!()),
    );
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    const id = await record();

    await processQueue();
    expect(await db.utterances.get(id)).toMatchObject({ status: 'pending', waitingFor: 'paused' });
    // Daarna geen bereik: dan is het weer gewoon wachten op bereik
    await processQueue();
    const offline = await db.utterances.get(id);
    expect(offline?.status).toBe('pending');
    expect(offline?.waitingFor).toBeUndefined();
    await processQueue();
    expect(await db.utterances.get(id)).toMatchObject({ status: 'pending', waitingFor: 'busy' });
    await processQueue();
    const done = await db.utterances.get(id);
    expect(done?.status).toBe('done');
    expect(done?.waitingFor).toBeUndefined();
    expect(done?.waitingSince).toBeUndefined();
  });

  it('fout van het model na het verstaan: transcript blijft, opnieuw slaat het verstaan over', async () => {
    network(true);
    model.respond = () => {
      throw new Error('Het model weigerde de uitspraak te verwerken');
    };
    const id = await record();
    await processQueue();
    expect(await db.utterances.get(id)).toMatchObject({
      status: 'failed',
      transcript: 'Roepje vink.',
      error: 'Het model weigerde de uitspraak te verwerken',
    });
    expect(vibrations).toEqual([FAILED]);

    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    await retry(id);
    await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('done'));
    expect(transcribeCalls).toBe(1);
    expect(await db.observations.count()).toBe(1);
  });

  it('teruggegeven prompt gaat niet naar het model, en staat in het log', async () => {
    // Zoals op 27 nov: een stuk zonder spraak werd de voorbeeldzinnen uit de prompt
    const echo =
      'Fluistervink, zes overvliegende houtduiven. Roepje vink. Twee zingende tjiftjaffen. ' +
      'Nee, keep in plaats van vink. Nog drie erbij. Die laatste weg. Wielewaal, een lifer! ' +
      'Feedback: de knop reageert traag.';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ text: echo }), { status: 200 })),
    );
    const id = await record();
    await processQueue();
    const u = await db.utterances.get(id);
    expect(u).toMatchObject({ status: 'done', result: 'ignored', transcript: '' });
    expect(u?.transcription?.promptEcho).toBe(12);
    expect(interpret).not.toHaveBeenCalled();
    expect(await db.observations.count()).toBe(0);
    await vi.waitFor(async () =>
      expect(
        await db.events.where('type').equals('transcribe_prompt_echo').toArray(),
      ).toMatchObject([{ utteranceId: id, data: { parts: 12, kept: 0 } }]),
    );
  });

  it('spraakherkenning van een verouderde poging schrijft geen transcript', async () => {
    const id = await record();
    // Terwijl de spraakherkenning loopt, neemt een ander exemplaar het over
    // (deze stond bevroren): die poging telt dan, deze niet meer
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        transcribeCalls++;
        await db.utterances.update(id, { attempts: 5 });
        return new Response(JSON.stringify({ text: 'Roepje vink.' }), { status: 200 });
      }),
    );
    await processQueue();
    const u = await db.utterances.get(id);
    expect(transcribeCalls).toBe(1);
    expect(u?.transcript).toBeUndefined();
    expect(u?.attempts).toBe(5);
    expect(interpret).not.toHaveBeenCalled();
  });

  it('plafond per dag: opname blijft bewaard, het sessiescherm hoort het', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: 'Daglimiet bereikt: vandaag is er al 5 uur ingesproken.', code: 'audio_limit' },
          { status: 429 },
        ),
      ),
    );
    const reached = vi.fn();
    const off = onDailyLimit(reached);
    const id = await record();
    await processQueue();
    off();
    expect(reached).toHaveBeenCalledExactlyOnceWith('audio');
    const u = await db.utterances.get(id);
    expect(u).toMatchObject({ status: 'failed', error: expect.stringMatching(/Daglimiet/) });
    expect(u?.audio).toBeDefined();
    expect(interpret).not.toHaveBeenCalled();
  });

  it('een andere fout van de proxy is geen plafond', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Te veel verzoeken' }, { status: 429 })),
    );
    const reached = vi.fn();
    const off = onDailyLimit(reached);
    await record();
    await processQueue();
    off();
    expect(reached).not.toHaveBeenCalled();
  });

  it('plafond van het model per dag: het sessiescherm hoort het ook', async () => {
    network(true);
    model.respond = () => {
      throw new ApiError('Daglimiet bereikt', 429, 'message_limit');
    };
    const reached = vi.fn();
    const off = onDailyLimit(reached);
    const id = await record();
    await processQueue();
    off();
    expect(reached).toHaveBeenCalledExactlyOnceWith('messages');
    expect((await db.utterances.get(id))?.status).toBe('failed');
  });

  it('token werkt niet meer (401): opnieuw aanmelden en het verzoek herhalen', async () => {
    const tokens: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_path: string, init: RequestInit) => {
        const token = new Headers(init.headers).get('Authorization') ?? '';
        tokens.push(token);
        if (token.endsWith('token-van-anna')) return Response.json({}, { status: 401 });
        return Response.json({ text: 'Roepje vink.' });
      }),
    );
    installer.register = async () => {
      localStorage.setItem('fluistervink.installToken', 'i1.nieuw');
      return { token: 'i1.nieuw', tester: 'app-12345678' };
    };
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    try {
      const id = await record();
      await processQueue();
      expect((await db.utterances.get(id))?.status).toBe('done');
      expect(tokens).toEqual(['Bearer i1.token-van-anna', 'Bearer i1.nieuw']);
    } finally {
      installer.register = undefined;
    }
  });

  it('afgesloten installatie: na één keer opnieuw aanmelden mislukt het', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (calls++, Response.json({}, { status: 401 }))),
    );
    installer.register = async () => {
      localStorage.setItem('fluistervink.installToken', 'i1.nieuw');
      return { token: 'i1.nieuw', tester: 'app-12345678' };
    };
    try {
      const id = await record();
      await processQueue();
      expect((await db.utterances.get(id))?.status).toBe('failed');
      expect(calls).toBe(2);
    } finally {
      installer.register = undefined;
    }
  });

  it('een mislukte uitspraak houdt de rest van de wachtrij niet op', async () => {
    network(true);
    model.respond = () => {
      throw new Error('Het model weigerde de uitspraak te verwerken');
    };
    const first = await record();
    const second = await record();
    await processQueue();
    expect((await db.utterances.get(first))?.status).toBe('failed');
    expect((await db.utterances.get(second))?.status).toBe('failed');
    expect(vibrations).toEqual([FAILED, FAILED]);
  });
  it.each(Object.entries(STORINGEN))(
    'storing "%s": de opname gaat niet verloren',
    async (_naam, { fetch, uitkomst }) => {
      vi.stubGlobal('fetch', fetch());
      const id = await record();
      await processQueue();
      stopWaiting();
      const u = await db.utterances.get(id);
      expect(u?.audio).toBeDefined();
      expect(u?.transcript).toBeUndefined();
      expect(interpret).not.toHaveBeenCalled();
      expect(await db.observations.count()).toBe(0);
      if (uitkomst === 'wacht') {
        expect(u).toMatchObject({ status: 'pending', waitingSince: expect.any(Number) });
      } else {
        expect(u?.status).toBe('failed');
      }
    },
  );

  // Trektelling in de service (proef scherm uit): een stuk komt als bestand
  // van de service binnen en gaat dan dezelfde weg als een opname van de knop
  it.each(Object.entries(STORINGEN))(
    'storing "%s": een trektelstuk van de service gaat niet verloren',
    async (_naam, { fetch, uitkomst }) => {
      vi.stubGlobal('fetch', fetch());
      const startedAt = clock + 5_000;
      await receiveScreenOffRecording(
        {
          // Elke test een eigen id: hetzelfde bestand neemt de webcode maar één keer aan
          id: `${crypto.randomUUID()}_${startedAt}_61000_trektel.m4a`,
          sessieId: SESSION,
          startedAt,
          durationMs: 61_000,
          type: 'audio/mp4',
          data: btoa('aac'),
          trektel: true,
          schermUitMs: 61_000,
        },
        Promise.resolve({ source: 'recent', position: POSITION, waitMs: 0 }),
      );
      // Bewaren zet de wachtrij zelf aan; wachten tot die klaar is
      const stored = () => db.utterances.filter((utt) => utt.trektel === true).first();
      await vi.waitFor(async () => {
        const u = await stored();
        expect(u?.status !== 'pending' || u.waitingSince !== undefined).toBe(true);
      });
      stopWaiting();
      const u = (await stored())!;
      expect(u).toMatchObject({ trektel: true, audioDurationMs: 61_000, position: POSITION });
      expect(u.audio).toBeDefined();
      expect(u.transcript).toBeUndefined();
      expect(interpret).not.toHaveBeenCalled();
      if (uitkomst === 'wacht') {
        expect(u).toMatchObject({ status: 'pending', waitingSince: expect.any(Number) });
      } else {
        expect(u.status).toBe('failed');
      }
    },
  );

  // Stuk waarvan de webcode het begin niet hoorde (pagina stilgezet met het
  // scherm uit): de plek van de telling, en een betere meting verbetert hem,
  // ook terwijl het stuk op bereik wacht of mislukt is
  it.each(Object.entries(STORINGEN))(
    'storing "%s": een trektelstuk zonder gemeld begin krijgt de plek van de telling',
    async (_naam, { fetch }) => {
      vi.stubGlobal('fetch', fetch());
      const good = { lat: 52.0, lon: 5.9, accuracy: 18, fixedAt: clock };
      startTrektelPosition(SESSION, clock + 1000, good);
      const startedAt = clock + 5_000;
      await receiveScreenOffRecording(
        {
          id: `${crypto.randomUUID()}_${startedAt}_61000_trektel.m4a`,
          sessieId: SESSION,
          startedAt,
          durationMs: 61_000,
          type: 'audio/mp4',
          data: btoa('aac'),
          trektel: true,
        },
        undefined,
      );
      const stored = () => db.utterances.filter((utt) => utt.trektel === true).first();
      await vi.waitFor(async () => {
        const u = await stored();
        expect(u?.status !== 'pending' || u.waitingSince !== undefined).toBe(true);
        expect(u?.position).toEqual(good);
      });
      stopWaiting();
      expect((await stored())?.positionLookup).toMatchObject({ source: 'trektel' });

      const better = { ...good, accuracy: 6, fixedAt: startedAt + 600_000 };
      await noteTrektelFix(better);
      expect((await stored())?.position).toEqual(better);
      expect((await stored())?.audio).toBeDefined();
      resetTrektelPosition();
    },
  );

  // Ontwikkeloptie "English": de taal hoort bij de uitspraak, ook na wachten
  // op bereik of "Opnieuw" (docs/plan-engels.md, stap 3)
  describe('Engelse uitspraak', () => {
    const brambling = () =>
      toolResponse(['add_observation', { species_name: 'Brambling', species_id: KEEP, count: 1 }]);

    async function recordEnglish(): Promise<string> {
      const id = await record();
      await db.utterances.update(id, { language: 'en' });
      return id;
    }

    /** Het formulier van het laatste verzoek aan de spraakherkenning */
    const lastForm = () => vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body as FormData;

    it('gaat in het Engels naar spraakherkenning en model', async () => {
      network(true);
      model.respond = brambling;
      const id = await recordEnglish();
      await processQueue();
      expect(lastForm().get('language')).toBe('en');
      expect(lastForm().get('prompt')).toContain('Brambling');
      expect(vi.mocked(interpret).mock.calls[0][2]).toMatchObject({ language: 'en' });
      const u = await db.utterances.get(id);
      expect(u).toMatchObject({ status: 'done', result: 'saved', language: 'en' });
      // De Engelse naam in species_name hoort bij Keep
      expect((await listObservations(SESSION))[0].speciesId).toBe(KEEP);
    });

    it('een nieuwe uitspraak bewaart de taal van de app', async () => {
      model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
      await submitText(SESSION, 'roepje vink');
      await vi.waitFor(async () => expect(await db.observations.count()).toBe(1));
      expect((await db.utterances.toArray()).at(-1)?.language).toBe('nl');
    });

    it('een Nederlandse uitspraak stuurt geen taal mee, zoals altijd', async () => {
      network(true);
      model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
      await record();
      await processQueue();
      expect(lastForm().has('language')).toBe(false);
      expect(vi.mocked(interpret).mock.calls[0][2]).toMatchObject({ language: 'nl' });
    });

    it.each(Object.entries(STORINGEN))(
      'storing "%s": blijft Engels als het daarna lukt',
      async (_naam, { fetch, uitkomst }) => {
        vi.stubGlobal('fetch', fetch());
        const id = await recordEnglish();
        await processQueue();
        stopWaiting();
        const waiting = await db.utterances.get(id);
        expect(waiting?.audio).toBeDefined();
        expect(waiting?.status).toBe(uitkomst === 'wacht' ? 'pending' : 'failed');

        network(true);
        model.respond = brambling;
        if (uitkomst === 'wacht') await processQueue();
        else await retry(id);
        await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('done'));
        expect(lastForm().get('language')).toBe('en');
        expect(vi.mocked(interpret).mock.calls.at(-1)?.[2]).toMatchObject({ language: 'en' });
      },
    );
  });

  describe('wachten op bereik', () => {
    const events = async (type: string) =>
      (await db.events.toArray()).filter((e) => e.type === type);

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    });

    afterEach(() => {
      stopWaiting();
      vi.useRealTimers();
      vi.mocked(interpret).mockClear();
    });

    const SAVED = [120];

    it('zonder bereik: niets mislukt, de wachtrij stopt bij de eerste', async () => {
      network(false);
      const first = await record();
      const second = await record();
      await processQueue();
      const [a, b] = await db.utterances.bulkGet([first, second]);
      expect(a).toMatchObject({ status: 'pending', waitingSince: expect.any(Number) });
      expect(a?.error).toBeUndefined();
      expect(b?.status).toBe('pending');
      expect(b?.waitingSince).toBeUndefined();
      // De tweede is niet geprobeerd: de volgorde blijft die van het inspreken
      expect(transcribeCalls).toBe(1);
      // "Bewaard, wacht op bereik" in plaats van drie korte trillen
      expect(vibrations).toEqual([WAITING]);
    });

    it('een nieuwe uitspraak terwijl er gewacht wordt: meteen het wachtpatroon', async () => {
      network(false);
      await record();
      await processQueue();
      await processQueue();
      expect(vibrations).toEqual([WAITING]);
      await submitText(SESSION, 'roepje vink');
      await vi.waitFor(() => expect(transcribeCalls).toBe(3));
      expect(vibrations).toEqual([WAITING, WAITING]);
    });

    it('kort gewacht: daarna gewoon per uitspraak een tril', async () => {
      network(false);
      await record();
      await record();
      await processQueue();
      network(true);
      await processQueue();
      expect(vibrations).toEqual([WAITING, SAVED, SAVED]);
    });

    it('wifi met een inlogpagina (HTML met status 200 of 511): wachten, niet verwerken', async () => {
      const portal = '<!doctype html><title>Log in op de wifi</title>';
      for (const status of [200, 511]) {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => {
            transcribeCalls++;
            return new Response(portal, { status, headers: { 'Content-Type': 'text/html' } });
          }),
        );
        const id = await record();
        await processQueue();
        const u = await db.utterances.get(id);
        expect(u).toMatchObject({ status: 'pending', waitingSince: expect.any(Number) });
        expect(u?.transcript).toBeUndefined();
        expect(u?.error).toBeUndefined();
        expect(interpret).not.toHaveBeenCalled();
        stopWaiting();
        await db.utterances.delete(id);
      }
      expect(vibrations).toEqual([WAITING, WAITING]);
      // Ingelogd op de wifi: gewoon verwerken
      const id = await record();
      network(true);
      await processQueue();
      expect((await db.utterances.get(id))?.status).toBe('done');
    });

    it('langer dan een minuut gewacht: één tril als alles binnen is', async () => {
      network(false);
      const first = await record();
      await record();
      await record();
      await processQueue();
      await db.utterances.update(first, { waitingSince: Date.now() - 2 * 60_000 });
      network(true);
      await processQueue();
      expect(await db.observations.count()).toBe(3);
      expect(vibrations).toEqual([WAITING, SAVED]);
    });

    it('logt één keer queue_waiting, geen attempt_failed per poging', async () => {
      network(false);
      const id = await record();
      await processQueue();
      const since = (await db.utterances.get(id))?.waitingSince;
      await processQueue();
      await processQueue();
      expect(transcribeCalls).toBe(3);
      expect((await db.utterances.get(id))?.waitingSince).toBe(since);
      expect(await events('queue_waiting')).toHaveLength(1);
      expect(await events('attempt_failed')).toEqual([]);
    });

    it('Probeer opnieuw: verwerkt meteen als er weer bereik is', async () => {
      network(false);
      const id = await record();
      await processQueue();
      expect((await db.utterances.get(id))?.status).toBe('pending');
      network(true);
      await retryNow();
      expect((await db.utterances.get(id))?.status).toBe('done');
      expect(await events('queue_retry_now')).toHaveLength(1);
    });

    it('Probeer opnieuw zonder bereik: blijft wachten, niets mislukt', async () => {
      network(false);
      const id = await record();
      await processQueue();
      await retryNow();
      const u = await db.utterances.get(id);
      expect(u?.status).toBe('pending');
      expect(u?.error).toBeUndefined();
      expect(transcribeCalls).toBe(2);
    });

    it('weer online: verwerkt alles op volgorde en logt queue_resumed', async () => {
      const seen: string[] = [];
      model.respond = (recent) => {
        seen.push(`na ${recent.length}`);
        return toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
      };
      network(false);
      const first = await record();
      const second = await record();
      await processQueue();

      network(true);
      window.dispatchEvent(new Event('online'));
      await vi.waitFor(async () => expect((await db.utterances.get(second))?.status).toBe('done'));
      // De eerste eerst: de tweede zag de waarneming van de eerste al
      expect(seen).toEqual(['na 0', 'na 1']);
      expect((await db.utterances.get(first))?.waitingSince).toBeUndefined();
      expect(await db.observations.count()).toBe(2);
      const [resumed] = await events('queue_resumed');
      expect(resumed?.data).toMatchObject({ count: 2, waitedMs: expect.any(Number) });
      expect(resumed?.utteranceId).toBe(first);
      // Gebieden en de naam van de sessie alsnog opzoeken, meteen (niet de pauze na een mislukte poging)
      expect(fillMissingAreas).toHaveBeenCalledWith(SESSION, { force: true });
    });

    it('probeert het vanzelf opnieuw na 15 s, 30 s, 1 min en daarna elke 2 min', async () => {
      network(false);
      const id = await record();
      await processQueue();
      expect(transcribeCalls).toBe(1);

      for (const [i, delay] of [15_000, 30_000, 60_000, 120_000, 120_000].entries()) {
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(transcribeCalls).toBe(i + 1);
        await vi.advanceTimersByTimeAsync(1);
        await vi.waitFor(() => expect(transcribeCalls).toBe(i + 2));
        // Wachten tot de poging klaar is en de volgende timer staat
        await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('pending'));
      }

      network(true);
      await vi.advanceTimersByTimeAsync(120_000);
      await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('done'));
    });

    it('verder als de app weer op het scherm komt', async () => {
      network(false);
      const id = await record();
      await processQueue();
      network(true);
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('done'));
    });

    it.each([502, 503, 504, 529])('wacht ook bij een tijdelijke fout (%i)', async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ error: 'Even weg' }, { status })),
      );
      const id = await record();
      await processQueue();
      expect((await db.utterances.get(id))?.status).toBe('pending');
    });

    it.each([
      [400, undefined],
      [401, undefined],
      [403, undefined],
      [429, 'audio_limit'],
    ])('mislukt nog steeds bij %i', async (status, code) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ error: 'Nee', code }, { status })),
      );
      const first = await record();
      const second = await record();
      await processQueue();
      expect((await db.utterances.get(first))?.status).toBe('failed');
      expect((await db.utterances.get(second))?.status).toBe('failed');
      expect(await events('queue_waiting')).toEqual([]);
    });

    it('na 2 uur wachten één keer een melding, met het aantal', async () => {
      network(false);
      const first = await record();
      await record();
      const heard = vi.fn();
      const off = onLongWait(heard);
      await processQueue();
      expect(heard).not.toHaveBeenCalled();
      await db.utterances.update(first, { waitingSince: Date.now() - LONG_WAIT_MS });
      await processQueue();
      await processQueue();
      off();
      expect(heard).toHaveBeenCalledTimes(1);
      expect(heard).toHaveBeenCalledWith(2);
      expect(await events('queue_long_wait')).toHaveLength(1);
    });

    it('zonder token en zonder bereik: aanmelden wacht ook', async () => {
      localStorage.removeItem('fluistervink.installToken');
      network(false);
      const id = await record();
      await processQueue();
      expect((await db.utterances.get(id))?.status).toBe('pending');
      expect((await db.utterances.get(id))?.waitingSince).toBeDefined();
    });

    it('een fout van het model terwijl de uitspraak al wachtte: mislukt, niet meer wachtend', async () => {
      network(false);
      const id = await record();
      await processQueue();
      network(true);
      model.respond = () => {
        throw new Error('Het model weigerde de uitspraak te verwerken');
      };
      await processQueue();
      const u = await db.utterances.get(id);
      expect(u).toMatchObject({ status: 'failed', transcript: 'Roepje vink.' });
      expect(u?.waitingSince).toBeUndefined();
    });
  });
});

describe('slot van de wachtrij', () => {
  let locks: FakeLockManager;

  beforeEach(() => {
    locks = new FakeLockManager();
    Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  const events = async (type: string) => (await db.events.toArray()).filter((e) => e.type === type);

  it('verwerkt gewoon als niemand het slot heeft', async () => {
    const id = await queue('vink');
    await processQueue();
    expect((await db.utterances.get(id))?.status).toBe('done');
    expect(await events('queue_lock_stolen')).toEqual([]);
  });

  it('pakt het slot af van een bevroren exemplaar als de app zichtbaar is', async () => {
    locks.holdForever('fluistervink-queue');
    const id = await queue('vink');
    const done = processQueue();
    await vi.advanceTimersByTimeAsync(STEAL_AFTER_MS - 1);
    expect((await db.utterances.get(id))?.status).toBe('pending');

    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect((await db.utterances.get(id))?.status).toBe('done');
    await vi.waitFor(async () =>
      expect(await events('queue_lock_stolen')).toMatchObject([
        { data: { held: ['bevroren'], pending: 1 } },
      ]),
    );
  });

  it('wacht zolang de app op de achtergrond staat', async () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    locks.holdForever('fluistervink-queue');
    const id = await queue('vink');
    const done = processQueue();
    await vi.advanceTimersByTimeAsync(3 * STEAL_AFTER_MS);
    expect((await db.utterances.get(id))?.status).toBe('pending');

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await vi.advanceTimersByTimeAsync(STEAL_AFTER_MS);
    await done;
    expect((await db.utterances.get(id))?.status).toBe('done');
  });

  it('bij het opstarten meteen afpakken', async () => {
    locks.holdForever('fluistervink-queue');
    const id = await queue('vink');
    await processQueue({ takeOver: true });
    expect((await db.utterances.get(id))?.status).toBe('done');
  });
});

describe('onzeker door instellingen', () => {
  const ROODHALSFUUT = 367; // zeldzaam bij waarneming.nl
  afterEach(() => localStorage.clear());

  it('zeldzame soort wordt onzeker, tenzij uitgezet', async () => {
    localStorage.setItem('fluistervink.pref.zeldzaamOnzeker', '0');
    await say('roodhalsfuut', ['add_observation', { species_id: ROODHALSFUUT, count: 1 }]);
    localStorage.removeItem('fluistervink.pref.zeldzaamOnzeker');
    const utterance = await say('roodhalsfuut', [
      'add_observation',
      { species_id: ROODHALSFUUT, count: 1 },
    ]);
    const [rare, without] = await listObservations(SESSION);
    expect(without.uncertain).toBe(false);
    expect(rare.uncertain).toBe(true);
    expect(rare.uncertainReason).toMatch(/Zeldzame soort \(Roodhalsfuut\)/);
    expect(utterance.result).toBe('uncertain');
  });

  it('gewone soort blijft zeker', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    const [obs] = await listObservations(SESSION);
    expect(obs.uncertain).toBe(false);
  });

  it('verbeteren naar een zeldzame soort wordt onzeker', async () => {
    await say('fuut', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('nee, die vorige was een roodhalsfuut', [
      'update_observation',
      { ref: 1, species_id: ROODHALSFUUT },
    ]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: ROODHALSFUUT, uncertain: true });
  });
});

describe('twijfel tussen soorten', () => {
  const FITIS = 89;
  const TJIFTJAF = 186;
  const TJIFTJAF_OF_FITIS = 595858;
  const twijfel = [
    'add_observation',
    {
      species_name: 'Tjiftjaf of Fitis',
      species_id: TJIFTJAF_OF_FITIS,
      count: 1,
      uncertain: true,
      candidate_species: ['Fitis', 'Tjiftjaf'],
    },
  ] as [string, object];

  it('bewaart de kandidaten bij de verzamelsoort', async () => {
    await say('fitis of tjiftjaf', twijfel);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({
      speciesId: TJIFTJAF_OF_FITIS,
      uncertain: true,
      candidates: [FITIS, TJIFTJAF],
    });
  });

  it('kiezen maakt hem zeker, met die soort', async () => {
    await say('fitis of tjiftjaf', twijfel);
    const [obs] = await listObservations(SESSION);
    await chooseCandidate(obs.id, FITIS);
    const chosen = await db.observations.get(obs.id);
    expect(chosen).toMatchObject({ speciesId: FITIS, uncertain: false, status: 'reviewed' });
    expect(chosen?.candidates).toBeUndefined();
  });

  it('"Klopt" houdt de verzamelsoort, zonder kandidaten', async () => {
    await say('fitis of tjiftjaf', twijfel);
    const [obs] = await listObservations(SESSION);
    await confirmObservation(obs.id);
    const confirmed = await db.observations.get(obs.id);
    expect(confirmed).toMatchObject({ speciesId: TJIFTJAF_OF_FITIS, uncertain: false });
    expect(confirmed?.candidates).toBeUndefined();
  });

  it('een correctie met de stem haalt de kandidaten weg, een opmerking niet', async () => {
    await say('fitis of tjiftjaf', twijfel);
    await say('zat op het hek', ['update_observation', { ref: 1, remarks: 'zat op het hek' }]);
    let [obs] = await listObservations(SESSION);
    expect(obs.candidates).toEqual([FITIS, TJIFTJAF]);

    await say('het was een tjiftjaf', [
      'update_observation',
      { ref: 1, species_name: 'Tjiftjaf', species_id: TJIFTJAF },
    ]);
    [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: TJIFTJAF, uncertain: false });
    expect(obs.candidates).toBeUndefined();
  });
});

describe('andere soortgroepen', () => {
  afterEach(() => localStorage.removeItem('fluistervink.pref.soortgroepen'));

  it('staan standaard aan, en uit bij Instellingen alleen vogels', async () => {
    await say('een ree', ['add_observation', { species_id: REE, count: 1 }]);
    expect(vi.mocked(interpret).mock.lastCall?.[2]).toMatchObject({ groups: true });
    setPreference('soortgroepen', false);
    await say('een vink', ['add_observation', { species_id: VINK, count: 1 }]);
    expect(vi.mocked(interpret).mock.lastCall?.[2]).toMatchObject({ groups: false });
  });

  it('vult ter plaatse en gezien in met de codes van de groep', async () => {
    await say('een ree', ['add_observation', { species_id: REE, count: 1 }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: REE, activityId: 15, methodId: 123 });
  });

  it('"nee, een vos": gedrag, methode en kleed gaan mee naar de nieuwe groep', async () => {
    await say('twee foeragerende juveniele vinken', [
      'add_observation',
      { species_id: VINK, count: 2, activity_id: 2, method_id: 48, life_stage_id: 5 },
    ]);
    await say('nee, een vos', ['update_observation', { ref: 1, species_id: VOS }]);
    const [obs] = await listObservations(SESSION);
    // foeragerend 2 → 16, gezien 48 → 123, juveniel 5 → 27
    expect(obs).toMatchObject({ speciesId: VOS, activityId: 16, methodId: 123, lifeStageId: 27 });
  });

  it('zet de codes ook om bij een andere soort in het formulier of via de kandidaten', async () => {
    await say('zingende vink', [
      'add_observation',
      { species_id: VINK, count: 1, activity_id: 4, method_id: 49, life_stage_id: 14 },
    ]);
    const [obs] = await listObservations(SESSION);
    await editObservation(obs.id, { speciesId: REE });
    const [after] = await listObservations(SESSION);
    // zingend en eerste kalenderjaar bestaan niet bij zoogdieren; gehoord wel
    expect(after).toMatchObject({ activityId: 15, methodId: 124 });
    expect(after.lifeStageId).toBeUndefined();
  });

  it('laat codes die de wijziging zelf zet staan', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    const [obs] = await listObservations(SESSION);
    await editObservation(obs.id, { speciesId: REE, activityId: 2029 });
    const [after] = await listObservations(SESSION);
    expect(after).toMatchObject({ activityId: 2029, methodId: 123 });
  });
});
