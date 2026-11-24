import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { STORINGEN } from '../test-helpers';
import { dueSessions, sendSummaries, setAnonStatsEnabled, summarize, WAIT_MS } from './summaries';

// Anonieme cijfers per sessie (stap 3 van "Statistieken en Developer
// uitbreiden"): alleen getallen, pas na export of een week, nooit dubbel.

const NOW = Date.parse('2026-12-01T12:00:00Z');
const DAY = 24 * 60 * 60_000;

async function session(id: string, endedAgo: number, extra: object = {}) {
  await db.sessions.add({
    id,
    startedAt: NOW - endedAgo - 62 * 60_000,
    endedAt: NOW - endedAgo,
    status: 'ended',
    ...extra,
  } as never);
}

beforeEach(async () => {
  localStorage.clear();
  // Deze functie "kwam" vóór de sessies op de telefoon
  localStorage.setItem('fluistervink.anonStatsSince', String(NOW - 30 * DAY));
  localStorage.setItem('fluistervink.accessCode', 'code');
  await Promise.all([db.sessions.clear(), db.utterances.clear(), db.observations.clear()]);
  await db.events.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('summarize', () => {
  it('telt alleen getallen, zonder feedback, plek of soorten', async () => {
    await session('s1', DAY, { exportedAt: NOW - 1000 });
    await db.utterances.bulkAdd([
      { id: 'u1', sessionId: 's1', recordedAt: 1, status: 'done', result: 'saved' },
      { id: 'u2', sessionId: 's1', recordedAt: 2, status: 'done', result: 'ignored' },
      {
        id: 'u3',
        sessionId: 's1',
        recordedAt: 3,
        status: 'done',
        result: 'saved',
        changes: [{ type: 'update', observationId: 'o1', before: {} }],
      },
      { id: 'u4', sessionId: 's1', recordedAt: 4, status: 'failed' },
      { id: 'u5', sessionId: 's1', recordedAt: 5, status: 'done', kind: 'dev_note' },
    ] as never);
    await db.observations.bulkAdd([
      { id: 'o1', sessionId: 's1', speciesId: 193, uncertain: true, status: 'reviewed' },
      { id: 'o2', sessionId: 's1', speciesId: 193, uncertain: false, status: 'draft' },
      { id: 'o3', sessionId: 's1', speciesId: 127, uncertain: false, status: 'exported' },
    ] as never);
    await db.events.add({ at: 1, type: 'queue_resumed', sessionId: 's1' });

    expect(await summarize('s1')).toEqual({
      minutes: 60,
      utterances: 4,
      observations: 3,
      species: 2,
      uncertain: 1,
      notUnderstood: 1,
      corrections: 1,
      failed: 1,
      reviewed: 2,
      offline: true,
      trektel: false,
      tuintelling: false,
      exported: 'waarneming',
      platform: 'web',
    });
  });
});

describe('dueSessions', () => {
  it('na export meteen, anders pas na een week, en niet van vóór de functie', async () => {
    await session('geexporteerd', DAY, { ebirdExportedAt: NOW });
    await session('net-gestopt', DAY);
    await session('week-oud', WAIT_MS + DAY);
    await session('heel-oud', 60 * DAY, { exportedAt: NOW });
    await db.sessions.add({ id: 'loopt', startedAt: NOW, status: 'active' } as never);
    expect((await dueSessions(NOW)).sort()).toEqual(['geexporteerd', 'week-oud']);
  });
});

describe('sendSummaries', () => {
  it('stuurt elke sessie één keer, met alleen de cijfers', async () => {
    await session('s1', DAY, { exportedAt: NOW });
    const fetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    expect(await sendSummaries(NOW)).toBe(1);
    expect(await sendSummaries(NOW)).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/summaries');
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual(
      [
        'corrections',
        'exported',
        'failed',
        'minutes',
        'notUnderstood',
        'observations',
        'offline',
        'platform',
        'reviewed',
        'species',
        'trektel',
        'tuintelling',
        'uncertain',
        'utterances',
      ].sort(),
    );
  });

  it('stuurt een oude sessie ook na honderden andere niet opnieuw', async () => {
    const many = Array.from({ length: 250 }, (_, i) => `s${i}`);
    for (const id of many) await session(id, DAY, { exportedAt: NOW });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    );
    expect(await sendSummaries(NOW)).toBe(250);
    expect(await sendSummaries(NOW)).toBe(0);
  });

  it('vergeet verwijderde sessies', async () => {
    await session('s1', DAY, { exportedAt: NOW });
    await session('s2', DAY, { exportedAt: NOW });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    );
    await sendSummaries(NOW);
    await db.sessions.delete('s1');
    expect(await sendSummaries(NOW)).toBe(0);
    expect(JSON.parse(localStorage.getItem('fluistervink.anonStatsSent')!)).toEqual(['s2']);
  });

  it('stuurt niets als het uit staat', async () => {
    setAnonStatsEnabled(false);
    await session('s1', DAY, { exportedAt: NOW });
    const fetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    expect(await sendSummaries(NOW)).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('slaat een sessie over die de proxy weigert, zodat de rest doorgaat', async () => {
    await session('s1', DAY, { exportedAt: NOW });
    await session('s2', DAY, { exportedAt: NOW });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: 'Ongeldige samenvatting' }, { status: 400 }))
      .mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    expect(await sendSummaries(NOW)).toBe(2);
    expect(await sendSummaries(NOW)).toBe(0);
  });

  it.each(Object.entries(STORINGEN))('bij %s: later opnieuw, niets kwijt', async (_, storing) => {
    await session('s1', DAY, { exportedAt: NOW });
    vi.stubGlobal('fetch', storing.fetch());
    expect(await sendSummaries(NOW)).toBe(0);
    // Weer bereik: nu gaat hij wel
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    );
    expect(await sendSummaries(NOW)).toBe(1);
  });
});
