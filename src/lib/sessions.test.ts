import { describe, expect, it } from 'vitest';
import { db, type Session } from './db';
import { ASK_AFTER_MS, AUTO_STOP_AFTER_MS, checkStaleSession, keepSession } from './sessions';

// Vergeten wandeling: na een uur stilte vragen, na 8 uur vanzelf stoppen.

const HOUR = 60 * 60_000;
const now = Date.parse('2026-10-11T20:00:00');

async function walk(startedHoursAgo: number, lastUtteranceHoursAgo?: number): Promise<Session> {
  const session: Session = { id: 'wandeling', startedAt: now - startedHoursAgo * HOUR, status: 'active' };
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
  it('doet niets zonder lopende wandeling', async () => {
    expect(await checkStaleSession(now)).toBeUndefined();
  });

  it('doet niets als er net nog iets ingesproken is', async () => {
    await walk(3, 0.5);
    expect(await checkStaleSession(now)).toBeUndefined();
  });

  it('vraagt na een uur zonder uitspraken, vanaf de laatste uitspraak', async () => {
    await walk(3, 2);
    expect(await checkStaleSession(now)).toEqual({
      kind: 'ask',
      session: expect.objectContaining({ id: 'wandeling' }),
      lastActivityAt: now - 2 * HOUR,
    });
  });

  it('telt de start als er nog niets ingesproken is', async () => {
    await walk(ASK_AFTER_MS / HOUR);
    expect((await checkStaleSession(now))?.kind).toBe('ask');
  });

  it('stopt na 8 uur, met de laatste uitspraak als eindtijd', async () => {
    await walk(10, AUTO_STOP_AFTER_MS / HOUR);
    expect((await checkStaleSession(now))?.kind).toBe('stopped');
    expect(await db.sessions.get('wandeling')).toMatchObject({
      status: 'ended',
      endedAt: now - 8 * HOUR,
    });
  });

  it('"ja, ga door" telt als activiteit', async () => {
    await walk(3, 2);
    await keepSession('wandeling');
    expect(await checkStaleSession()).toBeUndefined();
  });
});
