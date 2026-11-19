// Herinnering aan de export (instelling, standaard aan, preferences.ts): staan sessies
// een week klaar zonder export, of een week gestopt zonder dat ze zijn
// nagelopen, dan een melding op het hoofdscherm. Alles staat alleen op de
// telefoon; wat niet bij waarneming.nl staat, gaat verloren met de telefoon.

import type { Session } from './db';
import { t } from './i18n';

export const REMIND_AFTER_MS = 7 * 24 * 60 * 60_000;
/** "Later": zo lang geen melding */
export const SNOOZE_MS = 3 * 24 * 60 * 60_000;

const SNOOZE_KEY = 'fluistervink.exportReminderSnoozedAt';

export interface Reminder {
  /** Klaargezet, niet geëxporteerd, al een week */
  ready: number;
  /** Gestopt, niet nagelopen of geëxporteerd, al een week */
  unreviewed: number;
}

export function exportReminder(
  sessions: Session[],
  now: number,
  snoozedAt?: number,
): Reminder | undefined {
  if (snoozedAt !== undefined && now - snoozedAt < SNOOZE_MS) return undefined;
  const old = (time: number | undefined) => time !== undefined && now - time >= REMIND_AFTER_MS;
  const ready = sessions.filter((s) => s.readyAt && !s.exportedAt && old(s.readyAt)).length;
  const unreviewed = sessions.filter(
    (s) => s.status === 'ended' && !s.readyAt && !s.exportedAt && old(s.endedAt),
  ).length;
  return ready || unreviewed ? { ready, unreviewed } : undefined;
}

export function reminderText({ ready, unreviewed }: Reminder): string {
  if (!ready) return t('reminder.unreviewed', { n: unreviewed });
  const text = t('reminder.ready', { n: ready });
  return unreviewed
    ? t('reminder.readyAndUnreviewed', { text, n: unreviewed })
    : t('reminder.readyEnd', { text });
}

export function snoozedAt(): number | undefined {
  try {
    const value = Number(localStorage.getItem(SNOOZE_KEY));
    return value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function snooze(now = Date.now()): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(now));
  } catch {
    // Geen opslag: dan komt hij bij de volgende keer openen terug
  }
}
