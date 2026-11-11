import { describe, expect, it } from 'vitest';
import type { Session } from './db';
import { exportReminder, REMIND_AFTER_MS, reminderText, SNOOZE_MS } from './exportReminder';

const NOW = Date.parse('2026-11-20T09:00:00');
const DAY = 24 * 60 * 60_000;

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
    expect(exportReminder(sessions, NOW)).toBeUndefined();
  });

  it('telt klaarstaande en niet nagelopen sessies van een week of ouder', () => {
    const sessions = [
      session({ readyAt: NOW - REMIND_AFTER_MS }),
      session({ readyAt: NOW - 10 * DAY }),
      session({ endedAt: NOW - 8 * DAY }),
    ];
    const reminder = exportReminder(sessions, NOW);
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

  it('"Later" houdt hem drie dagen weg', () => {
    const sessions = [session({ readyAt: NOW - 10 * DAY })];
    expect(exportReminder(sessions, NOW, NOW - DAY)).toBeUndefined();
    expect(exportReminder(sessions, NOW, NOW - SNOOZE_MS)).toEqual({ ready: 1, unreviewed: 0 });
  });
});
