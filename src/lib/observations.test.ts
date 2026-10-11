import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeLockManager, HOUTDUIF, KEEP, VINK, toolResponse } from '../test-helpers';
import { db, type Observation, type Utterance } from './db';
import { interpret } from './interpret';
import { STEAL_AFTER_MS, listObservations, processQueue, retry } from './observations';

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

const SESSION = 'wandeling';
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
    await say('nee, keep', ['update_observation', { ref: 1, species_id: KEEP }]);
    const [obs] = await listObservations(SESSION);
    expect(obs).toMatchObject({ speciesId: KEEP, uncertain: false });
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

describe('wachtrij', () => {
  it('feedback gaat niet naar het model', async () => {
    const utterance = await say('Feedback, de knop is te klein');
    expect(utterance).toMatchObject({ status: 'done', kind: 'dev_note', result: 'note' });
    expect(interpret).not.toHaveBeenCalled();
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
