import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';

// Gebieden alsnog opzoeken: zonder verbinding niet bij elke wijziging opnieuw
// proberen (het sessiescherm deed dat elke seconde), wel als de wachtrij weet
// dat er weer verbinding is.

const fetchArea = vi.fn();
vi.mock('./api', async (actual) => ({
  ...(await actual<typeof import('./api')>()),
  fetchArea: (lat: number, lon: number) => fetchArea(lat, lon),
}));

const { AREA_RETRY_MS, fillMissingAreas } = await import('./area');

const position = { lat: 52, lon: 5, accuracy: 10, fixedAt: 0 };
const area = { id: 1, name: 'Ergens' };

// De pauze na een mislukte poging leeft in de module: elke test op zijn eigen tijd
let clock = 0;
function later() {
  clock += 10 * AREA_RETRY_MS;
  return clock;
}

beforeEach(async () => {
  fetchArea.mockReset();
  await db.sessions.add({ id: 's', startedAt: 0, status: 'active' });
  await db.utterances.add({ id: 'u', sessionId: 's', recordedAt: 0, status: 'done', position });
});

describe('fillMissingAreas', () => {
  it('zet het gebied bij een uitspraak zonder gebied', async () => {
    fetchArea.mockResolvedValue(area);
    await fillMissingAreas('s', { now: later() });
    expect((await db.utterances.get('u'))?.area).toEqual(area);
  });

  it('probeert het na een mislukte poging een minuut niet vanzelf opnieuw', async () => {
    fetchArea.mockRejectedValue(new Error('Proxy niet bereikbaar'));
    const start = later();
    await fillMissingAreas('s', { now: start });
    await fillMissingAreas('s', { now: start + 1000 });
    await fillMissingAreas('s', { now: start + AREA_RETRY_MS - 1 });
    expect(fetchArea).toHaveBeenCalledTimes(1);

    fetchArea.mockResolvedValue(area);
    await fillMissingAreas('s', { now: start + AREA_RETRY_MS });
    expect(fetchArea).toHaveBeenCalledTimes(2);
    expect((await db.utterances.get('u'))?.area).toEqual(area);
  });

  it('probeert het meteen opnieuw als de wachtrij weer verbinding heeft', async () => {
    fetchArea.mockRejectedValueOnce(new Error('Proxy niet bereikbaar'));
    const start = later();
    await fillMissingAreas('s', { now: start });
    fetchArea.mockResolvedValue(area);
    await fillMissingAreas('s', { now: start + 1000, force: true });
    expect(fetchArea).toHaveBeenCalledTimes(2);
    expect((await db.utterances.get('u'))?.area).toEqual(area);
  });
});
