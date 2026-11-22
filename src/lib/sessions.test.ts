import { describe, expect, it } from 'vitest';
import { db, type Session } from './db';
import {
  ASK_AFTER_MS,
  AUTO_STOP_AFTER_MS,
  checkStaleSession,
  countPerSession,
  formatDuration,
  isFiledAway,
  notForExport,
  keepSession,
} from './sessions';

// Vergeten sessie: na een uur stilte vragen, na 8 uur vanzelf stoppen.

const HOUR = 60 * 60_000;
const now = Date.parse('2026-10-11T20:00:00');

async function activeSession(
  startedHoursAgo: number,
  lastUtteranceHoursAgo?: number,
): Promise<Session> {
  const session: Session = {
    id: 'sessie',
    startedAt: now - startedHoursAgo * HOUR,
    status: 'active',
  };
  await db.sessions.add(session);
  if (lastUtteranceHoursAgo !== undefined) {
    await db.utterances.add({
      id: 'uitspraak',
      sessionId: session.id,
      recordedAt: now - lastUtteranceHoursAgo * HOUR,
      status: 'done',
    });
  }
  return session;
}

describe('checkStaleSession', () => {
  it('doet niets zonder lopende sessie', async () => {
    expect(await checkStaleSession(now)).toBeUndefined();
  });

  it('doet niets als er net nog iets ingesproken is', async () => {
    await activeSession(3, 0.5);
    expect(await checkStaleSession(now)).toBeUndefined();
  });

  it('een klok die terugspringt (uitspraak "in de toekomst"): niet vragen en niet stoppen', async () => {
    await activeSession(2, -3);
    expect(await checkStaleSession(now)).toBeUndefined();
    expect((await db.sessions.get('sessie'))?.status).toBe('active');
  });

  it('vraagt na een uur zonder uitspraken, vanaf de laatste uitspraak', async () => {
    await activeSession(3, 2);
    expect(await checkStaleSession(now)).toEqual({
      kind: 'ask',
      session: expect.objectContaining({ id: 'sessie' }),
      lastActivityAt: now - 2 * HOUR,
    });
  });

  it('telt de start als er nog niets ingesproken is', async () => {
    await activeSession(ASK_AFTER_MS / HOUR);
    expect((await checkStaleSession(now))?.kind).toBe('ask');
  });

  it('stopt na 8 uur, met de laatste uitspraak als eindtijd', async () => {
    await activeSession(10, AUTO_STOP_AFTER_MS / HOUR);
    expect((await checkStaleSession(now))?.kind).toBe('stopped');
    expect(await db.sessions.get('sessie')).toMatchObject({
      status: 'ended',
      endedAt: now - 8 * HOUR,
    });
  });

  it('"ja, ga door" telt als activiteit', async () => {
    await activeSession(3, 2);
    await keepSession('sessie');
    expect(await checkStaleSession()).toBeUndefined();
  });
});

describe('countPerSession', () => {
  it('telt mislukte en wachtende uitspraken als niet verwerkt', async () => {
    // Geen bereik: de opname is bewaard maar nog geen waarneming geworden
    await db.utterances.bulkAdd([
      { id: 'a', sessionId: 'sessie', recordedAt: now, status: 'failed' },
      { id: 'b', sessionId: 'sessie', recordedAt: now, status: 'pending' },
      { id: 'c', sessionId: 'sessie', recordedAt: now, status: 'done' },
    ]);
    expect((await countPerSession()).get('sessie')).toEqual({
      utterances: 3,
      observations: 0,
      devNotes: 0,
      unprocessed: 2,
    });
  });
});

describe('formatDuration', () => {
  it('in minuten en uren, nooit negatief', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(-500)).toBe('0 min');
    expect(formatDuration(59 * 60_000)).toBe('59 min');
    expect(formatDuration(75 * 60_000)).toBe('1 u 15 min');
  });
});

describe('isFiledAway', () => {
  const DAY = 24 * HOUR;
  const ended = (extra: Partial<Session>): Session => ({
    id: 's',
    startedAt: now - 30 * DAY,
    status: 'ended',
    ...extra,
  });
  const none = new Set<string>();

  it('klapt een sessie in een week na de export', () => {
    expect(isFiledAway(ended({ exportedAt: now - 8 * DAY }), false, none, now)).toBe(true);
    expect(isFiledAway(ended({ exportedAt: now - 6 * DAY }), false, none, now)).toBe(false);
  });

  it('laat niet-geëxporteerde en lopende sessies staan', () => {
    expect(isFiledAway(ended({ readyAt: now - 8 * DAY }), false, none, now)).toBe(false);
    const active = ended({ status: 'active', exportedAt: now - 8 * DAY });
    expect(isFiledAway(active, false, none, now)).toBe(false);
  });

  it('met eBird: pas als eBird ook af is, gerekend vanaf de laatste export', () => {
    const s = ended({ exportedAt: now - 10 * DAY });
    expect(isFiledAway(s, true, new Set(['s']), now)).toBe(false);
    const both = ended({ exportedAt: now - 10 * DAY, ebirdExportedAt: now - 2 * DAY });
    expect(isFiledAway(both, true, none, now)).toBe(false);
    expect(isFiledAway(ended({ ebirdExportedAt: now - 8 * DAY }), true, none, now)).toBe(true);
    // Zonder eBird telt alleen waarneming.nl
    expect(isFiledAway(ended({ ebirdExportedAt: now - 8 * DAY }), false, none, now)).toBe(false);
  });
});

describe('tuintelling zonder export', () => {
  const DAY = 24 * HOUR;
  const tuin = (extra: Partial<Session>): Session => ({
    id: 't',
    startedAt: now - 10 * DAY,
    endedAt: now - 10 * DAY,
    status: 'ended',
    tuintelling: true,
    ...extra,
  });
  const none = new Set<string>();

  it('vraagt geen export, tenzij klaargezet of al geëxporteerd', () => {
    expect(notForExport(tuin({}))).toBe(true);
    expect(notForExport(tuin({ readyAt: now }))).toBe(false);
    expect(notForExport(tuin({ ebirdExportedAt: now }))).toBe(false);
    expect(notForExport({ ...tuin({}), tuintelling: undefined })).toBe(false);
  });

  it('klapt een week na het stoppen weg', () => {
    expect(isFiledAway(tuin({}), false, none, now)).toBe(true);
    expect(isFiledAway(tuin({ endedAt: now - 2 * DAY }), false, none, now)).toBe(false);
    expect(isFiledAway(tuin({ readyAt: now - 9 * DAY }), false, none, now)).toBe(false);
  });
});
