import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeLockManager, HOUTDUIF, KEEP, VINK, toolResponse } from '../test-helpers';
import { db, type Observation, type Utterance } from './db';
import { interpret } from './interpret';
import {
  STEAL_AFTER_MS,
  isAccidental,
  listObservations,
  processQueue,
  retry,
} from './observations';

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
    // Getypt: geen opname
    expect(isAccidental({ audioDurationMs: 20_000, transcript: 'x' })).toBe(false);
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

describe('netwerk weg', () => {
  // Een opname gaat eerst naar /api/transcribe (echte api.ts, nagebootste
  // fetch), daarna naar het (nagebootste) model.
  const audio = new Blob(['opus'], { type: 'audio/webm' });
  let vibrations: number[][];
  let transcribeCalls: number;

  beforeEach(() => {
    vibrations = [];
    transcribeCalls = 0;
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
      audio,
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
