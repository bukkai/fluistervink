import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, type Position, type Utterance } from './db';
import { VINK } from '../test-helpers';

// De plek van trektelstukken: je staat stil, dus de beste meting van de
// telling, ook een oudere; een latere, betere meting verbetert de stukken
// tot de telling stopt.

const currentPosition = vi.hoisted(() => vi.fn());
vi.mock('./location.svelte', () => ({ currentPosition }));
const attachArea = vi.hoisted(() => vi.fn(async () => true));
vi.mock('./area', () => ({ attachArea }));
vi.mock('./log', () => ({ logEvent: vi.fn() }));

const {
  chunkPosition,
  endTrektelPosition,
  noteTrektelFix,
  resetTrektelPosition,
  startTrektelPosition,
  trektelLookup,
  SEED_MAX_MS,
} = await import('./trektelPosition');

const SESSION = 's1';
const START = Date.parse('2026-11-19T21:12:47');
const fix = (accuracy: number, minutes: number): Position => ({
  lat: 52.1,
  lon: 4.3,
  accuracy,
  fixedAt: START + minutes * 60_000,
});

/** Een trektelstuk met een waarneming */
async function chunk(minutes: number, extra: Partial<Utterance> = {}): Promise<string> {
  const id = crypto.randomUUID();
  const recordedAt = START + minutes * 60_000;
  await db.utterances.add({
    id,
    sessionId: SESSION,
    recordedAt,
    status: 'done',
    trektel: true,
    positionLookup: { source: 'none', waitMs: 0 },
    ...extra,
  });
  await db.observations.add({
    id: 'obs-' + id,
    sessionId: SESSION,
    utteranceId: id,
    speciesId: VINK,
    count: 1,
    observedAt: recordedAt,
    createdAt: 0,
    uncertain: false,
    status: 'draft',
    position: extra.position,
  });
  return id;
}

afterEach(() => {
  resetTrektelPosition();
  vi.clearAllMocks();
});

describe('plek van trektelstukken', () => {
  it('een stuk krijgt de beste meting van de telling, ook een oudere', async () => {
    const good = fix(18, 0);
    startTrektelPosition(SESSION, START + 10_000, good);
    // Na het ontgrendelen eerst een grove meting: telt niet
    await noteTrektelFix(fix(200, 30));
    expect(await chunkPosition(SESSION)).toEqual({
      source: 'trektel',
      position: good,
      waitMs: 0,
    });
    expect(currentPosition).not.toHaveBeenCalled();
  });

  it('nog geen meting: gewoon opvragen', async () => {
    currentPosition.mockResolvedValue({ source: 'none', waitMs: 0 });
    startTrektelPosition(SESSION, START);
    await chunkPosition(SESSION);
    expect(currentPosition).toHaveBeenCalled();
    // Andere sessie: niet de plek van deze telling
    await noteTrektelFix(fix(10, 1));
    expect(trektelLookup('andere-sessie')).toBeUndefined();
  });

  it('een meting van lang vóór de start telt niet (misschien liep je nog)', () => {
    startTrektelPosition(SESSION, START + SEED_MAX_MS + 1, fix(5, 0));
    expect(trektelLookup(SESSION)).toBeUndefined();
  });

  it('een nieuwere goede meting vervangt een oudere, een grove niet', async () => {
    startTrektelPosition(SESSION, START, fix(10, 0));
    await noteTrektelFix(fix(25, 5));
    expect(trektelLookup(SESSION)?.position?.accuracy).toBe(25);
    await noteTrektelFix(fix(100, 6));
    expect(trektelLookup(SESSION)?.position?.accuracy).toBe(25);
  });

  it('een betere meting verbetert de stukken van de telling', async () => {
    startTrektelPosition(SESSION, START);
    const coarse = await chunk(1, { position: fix(200, 2) });
    const unplaced = await chunk(2);
    const alreadyGood = await chunk(3, { position: fix(5, 3) });
    const before = await chunk(-1, { position: fix(200, -1) });
    const notTrektel = await chunk(4, { trektel: undefined, position: fix(200, 4) });
    const searching = await chunk(5, { positionLookup: undefined });

    const better = fix(9, 30);
    await noteTrektelFix(better);

    const get = async (id: string) => (await db.utterances.get(id))!;
    expect((await get(coarse)).position).toEqual(better);
    expect((await get(coarse)).positionLookup).toMatchObject({ source: 'trektel' });
    expect((await get(unplaced)).position).toEqual(better);
    expect((await get(alreadyGood)).position?.accuracy).toBe(5);
    expect((await get(before)).position?.accuracy).toBe(200);
    expect((await get(notTrektel)).position?.accuracy).toBe(200);
    expect((await get(searching)).position).toBeUndefined();
    expect((await db.observations.get('obs-' + coarse))?.position).toEqual(better);
    expect((await db.observations.get('obs-' + unplaced))?.position).toEqual(better);
    // Gebied alleen bij een eerste plek
    expect(attachArea).toHaveBeenCalledTimes(1);
    expect(attachArea).toHaveBeenCalledWith(unplaced, better);
  });

  it('met de hand gezet blijft staan; een gezegde plek wordt opnieuw uitgerekend', async () => {
    startTrektelPosition(SESSION, START);
    const hand = await chunk(1, { position: fix(200, 1) });
    const hereByHand = { lat: 52.2, lon: 4.4, accuracy: 10, fixedAt: START };
    await db.observations.update('obs-' + hand, {
      position: hereByHand,
      recordedPosition: fix(200, 1),
    });
    const voice = await chunk(2, { position: fix(200, 2) });
    await db.observations.update('obs-' + voice, {
      spokenPlace: { text: '500 m noord', distanceM: 500, direction: 'N' },
      placedByVoice: true,
      recordedPosition: fix(200, 2),
    });

    const better = fix(8, 10);
    await noteTrektelFix(better);

    const byHand = await db.observations.get('obs-' + hand);
    expect(byHand?.position).toEqual(hereByHand);
    expect(byHand?.recordedPosition).toEqual(better);
    const byVoice = await db.observations.get('obs-' + voice);
    expect(byVoice?.recordedPosition).toEqual(better);
    expect(byVoice?.position?.lat).toBeGreaterThan(better.lat);
  });

  it('na het stoppen van de telling verbetert niets meer (je loopt misschien weg)', async () => {
    startTrektelPosition(SESSION, START, fix(50, 0));
    const id = await chunk(1, { position: fix(50, 0) });
    endTrektelPosition();
    await noteTrektelFix(fix(5, 20));
    expect((await db.utterances.get(id))?.position?.accuracy).toBe(50);
    // Het laatste stuk komt pas na het stoppen binnen: de plek geldt nog
    expect(trektelLookup(SESSION)?.position?.accuracy).toBe(50);
  });
});
