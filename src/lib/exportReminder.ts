// Herinnering aan de export (instelling, standaard aan, preferences.ts): staan sessies
// een week klaar zonder export, of een week gestopt zonder dat ze zijn
// nagelopen, dan een melding op het hoofdscherm. Alles staat alleen op de
// telefoon; wat niet bij waarneming.nl staat, gaat verloren met de telefoon.
// Een tuintelling niet: die hoeft niet naar waarneming.nl (notForExport).
// Een sessie zonder iets om te exporteren ook niet (een test, per ongeluk
// gestart, alles uitgevinkt): exporteren markeert die niet, dus de melding
// zou elke drie dagen terugkomen (kwaliteitsronde 25 nov).

import { db, type Session } from './db';
import { t } from './i18n';
import { notForExport } from './sessions';

/** Welke sessies iets hebben om te exporteren */
export interface ExportContent {
  /**
   * Om na te lopen: een waarneming die mee mag (een plek kan er bij het
   * nalopen nog bij), of een uitspraak die nog niet verwerkt is
   */
  toReview: Set<string>;
  /** Om te exporteren: een waarneming die mee mag mét plek, of een onverwerkte uitspraak */
  toExport: Set<string>;
}

export async function exportContent(): Promise<ExportContent> {
  const toReview = new Set<string>();
  const toExport = new Set<string>();
  await db.observations.each((obs) => {
    if (obs.skipExport) return;
    toReview.add(obs.sessionId);
    if (obs.position) toExport.add(obs.sessionId);
  });
  // Via de index op status; normaal zijn dit er geen of een paar
  await db.utterances
    .where('status')
    .anyOf('failed', 'pending', 'processing')
    .each((u) => {
      if (u.kind === 'dev_note') return;
      toReview.add(u.sessionId);
      toExport.add(u.sessionId);
    });
  return { toReview, toExport };
}

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

/**
 * @param content Welke sessies iets hebben om te exporteren; nog niet geladen:
 *   geen melding (niet even tonen en dan weghalen)
 */
export function exportReminder(
  sessions: Session[],
  content: ExportContent | undefined,
  now: number,
  snoozedAt?: number,
): Reminder | undefined {
  if (!content) return undefined;
  if (snoozedAt !== undefined && now - snoozedAt < SNOOZE_MS) return undefined;
  const old = (time: number | undefined) => time !== undefined && now - time >= REMIND_AFTER_MS;
  const ready = sessions.filter(
    (s) => s.readyAt && !s.exportedAt && old(s.readyAt) && content.toExport.has(s.id),
  ).length;
  const unreviewed = sessions.filter(
    (s) =>
      s.status === 'ended' &&
      !s.readyAt &&
      !s.exportedAt &&
      !notForExport(s) &&
      old(s.endedAt) &&
      content.toReview.has(s.id),
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
