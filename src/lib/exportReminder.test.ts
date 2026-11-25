import { beforeEach, describe, expect, it } from 'vitest';
import { observation } from '../test-helpers';
import { db, type Session } from './db';
import {
  exportContent,
  exportReminder,
  REMIND_AFTER_MS,
  reminderText,
  SNOOZE_MS,
  type ExportContent,
} from './exportReminder';

const NOW = Date.parse('2026-11-20T09:00:00');
const DAY = 24 * 60 * 60_000;

/** Elke sessie heeft iets om te exporteren */
function all(sessions: Session[]): ExportContent {
  const ids = new Set(sessions.map((s) => s.id));
  return { toReview: ids, toExport: ids };
}

function session(fields: Partial<Session>): Session {
  return {
    id: crypto.randomUUID(),
    startedAt: NOW - 30 * DAY,
    endedAt: NOW - 30 * DAY,
    status: 'ended',
    ...fields,
  };
}

describe('herinnering aan de export', () => {
  it('niets als alles geëxporteerd is of nog geen week oud', () => {
    const sessions = [
      session({ readyAt: NOW - 20 * DAY, exportedAt: NOW - 19 * DAY }),
      session({ readyAt: NOW - 2 * DAY }),
      session({ endedAt: NOW - 3 * DAY }),
      session({ status: 'active', endedAt: undefined }),
    ];
    expect(exportReminder(sessions, all(sessions), NOW)).toBeUndefined();
  });

  it('telt klaarstaande en niet nagelopen sessies van een week of ouder', () => {
    const sessions = [
      session({ readyAt: NOW - REMIND_AFTER_MS }),
      session({ readyAt: NOW - 10 * DAY }),
      session({ endedAt: NOW - 8 * DAY }),
    ];
    const reminder = exportReminder(sessions, all(sessions), NOW);
    expect(reminder).toEqual({ ready: 2, unreviewed: 1 });
    expect(reminderText(reminder!)).toBe(
      '2 sessies staan al een week klaar voor waarneming.nl, 1 nog niet nagelopen.',
    );
    expect(reminderText({ ready: 1, unreviewed: 0 })).toBe(
      '1 sessie staat al een week klaar voor waarneming.nl.',
    );
    expect(reminderText({ ready: 0, unreviewed: 2 })).toBe(
      '2 sessies van meer dan een week geleden zijn nog niet nagelopen.',
    );
  });

  it('een tuintelling herinnert alleen als hij klaargezet is', () => {
    const sessions = [
      session({ tuintelling: true, endedAt: NOW - 10 * DAY }),
      session({ tuintelling: true, readyAt: NOW - 10 * DAY }),
    ];
    expect(exportReminder(sessions, all(sessions), NOW)).toEqual({ ready: 1, unreviewed: 0 });
  });

  it('"Later" houdt hem drie dagen weg', () => {
    const sessions = [session({ readyAt: NOW - 10 * DAY })];
    expect(exportReminder(sessions, all(sessions), NOW, NOW - DAY)).toBeUndefined();
    expect(exportReminder(sessions, all(sessions), NOW, NOW - SNOOZE_MS)).toEqual({
      ready: 1,
      unreviewed: 0,
    });
  });
});

describe('herinnering: alleen sessies met iets om te exporteren', () => {
  const HERE = { lat: 52.6, lon: 4.7, accuracy: 10, fixedAt: NOW };

  beforeEach(async () => {
    await db.observations.clear();
    await db.utterances.clear();
  });

  it('telt een lege of helemaal uitgevinkte sessie niet', () => {
    const empty = session({ endedAt: NOW - 10 * DAY });
    const emptyReady = session({ readyAt: NOW - 10 * DAY });
    const content = { toReview: new Set<string>(), toExport: new Set<string>() };
    expect(exportReminder([empty, emptyReady], content, NOW)).toBeUndefined();
  });

  it('nalopen kan zonder plek, klaarstaan pas met een plek', () => {
    const unreviewed = session({ endedAt: NOW - 10 * DAY });
    const ready = session({ readyAt: NOW - 10 * DAY });
    const content = {
      toReview: new Set([unreviewed.id, ready.id]),
      toExport: new Set<string>(),
    };
    expect(exportReminder([unreviewed, ready], content, NOW)).toEqual({ ready: 0, unreviewed: 1 });
  });

  it('nog niet geladen: geen melding', () => {
    expect(exportReminder([session({ readyAt: NOW - 10 * DAY })], undefined, NOW)).toBeUndefined();
  });

  it('leest uit de database wat mee kan', async () => {
    await db.observations.bulkAdd([
      observation({ sessionId: 'met-plek', position: HERE }),
      observation({ sessionId: 'zonder-plek' }),
      observation({ sessionId: 'uitgevinkt', position: HERE, skipExport: true }),
    ]);
    await db.utterances.bulkAdd([
      { id: 'u1', sessionId: 'wacht', recordedAt: NOW, status: 'pending' },
      { id: 'u2', sessionId: 'feedback', recordedAt: NOW, status: 'failed', kind: 'dev_note' },
      { id: 'u3', sessionId: 'klaar', recordedAt: NOW, status: 'done' },
    ]);
    const { toReview, toExport } = await exportContent();
    expect([...toReview].sort()).toEqual(['met-plek', 'wacht', 'zonder-plek']);
    expect([...toExport].sort()).toEqual(['met-plek', 'wacht']);
  });
});
