import type Anthropic from '@anthropic-ai/sdk';
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeLockManager, HOUTDUIF, KEEP, VINK, toolResponse } from '../test-helpers';
import { db, storeAudio, type Observation, type PositionLookup, type Utterance } from './db';
import { interpret } from './interpret';
import {
  HAND_ACCURACY,
  STEAL_AFTER_MS,
  copyObservation,
  editObservation,
  isAccidental,
  isBareNo,
  listObservations,
  migrateAudio,
  placeByHand,
  processQueue,
  recordedPlace,
  retry,
  setSkipExport,
  submitText,
} from './observations';
import { UNKNOWN_PLACE_ACCURACY } from './spokenPlace';
import { distanceMeters } from './interpret';

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
    interpret: vi.fn(async (_transcript: string, recent: Observation[]) => {
      const response = model.respond(recent);
      return {
        ...actual.parseResponse(response, recent),
        response,
        context: '',
        contextIds: recent.map((obs) => obs.id),
        timing: { requestMs: 0 },
      };
    }),
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
vi.mock('./area', () => ({ attachArea: async () => false }));

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

  it('twee keer ongedaan maken gaat twee stappen terug', async () => {
    await say('vink', ['add_observation', { species_id: VINK, count: 1 }]);
    await say('houtduif', ['add_observation', { species_id: HOUTDUIF, count: 1 }]);
    await say('ongedaan maken', ['undo', {}]);
    await say('ongedaan maken', ['undo', {}]);
    expect(await db.observations.count()).toBe(0);
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

  it('pakt uitspraken op die bleven hangen (app afgesloten tijdens verwerken)', async () => {
    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    const id = await queue('vink');
    await db.utterances.update(id, { status: 'processing' });
    await processQueue();
    expect((await db.utterances.get(id))?.status).toBe('done');
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

  it('weg tijdens het uploaden: opname blijft bewaard, drie korte trillen', async () => {
    network(false);
    const id = await record();
    await processQueue();
    const u = await db.utterances.get(id);
    expect(u?.status).toBe('failed');
    expect(u?.audio).toBeDefined();
    expect(u?.transcript).toBeUndefined();
    expect(u?.error).toMatch(/^Spraakherkenning: /);
    expect(vibrations).toEqual([FAILED]);
    expect(interpret).not.toHaveBeenCalled();
  });

  it('weg tussen verstaan en interpreteren: transcript blijft, opnieuw slaat het verstaan over', async () => {
    network(true);
    model.respond = () => {
      throw new Error('Geen internetverbinding');
    };
    const id = await record();
    await processQueue();
    expect(await db.utterances.get(id)).toMatchObject({
      status: 'failed',
      transcript: 'Roepje vink.',
      error: 'Geen internetverbinding',
    });
    expect(vibrations).toEqual([FAILED]);

    model.respond = () => toolResponse(['add_observation', { species_id: VINK, count: 1 }]);
    await retry(id);
    await vi.waitFor(async () => expect((await db.utterances.get(id))?.status).toBe('done'));
    expect(transcribeCalls).toBe(1);
    expect(await db.observations.count()).toBe(1);
  });

  it('een mislukte uitspraak houdt de rest van de wachtrij niet op', async () => {
    network(false);
    const first = await record();
    const second = await record();
    await processQueue();
    expect((await db.utterances.get(first))?.status).toBe('failed');
    expect((await db.utterances.get(second))?.status).toBe('failed');
    expect(vibrations).toEqual([FAILED, FAILED]);
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
