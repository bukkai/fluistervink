import type { Observation } from './db';
import { LOCALE, t } from './i18n';

/**
 * Opmaak van datum en tijd die op meer schermen terugkomt, op één plek zodat
 * ze overal hetzelfde zijn. Een opmaak die maar één scherm gebruikt, blijft
 * daar staan.
 */

/** "14:32" */
export const timeFormat = new Intl.DateTimeFormat(LOCALE, { timeStyle: 'short' });

/** "ma 12 okt" */
export const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "12 okt 14:32" */
export const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "12 okt 2026, 14:32" */
export const dateYearTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** "vandaag 14:32" of "ma 12 okt 14:32" */
export function formatMoment(at: number): string {
  const day =
    new Date(at).toDateString() === new Date().toDateString()
      ? t('common.today')
      : dayFormat.format(at);
  return t('format.moment', { day, time: timeFormat.format(at) });
}

/** Resterende tijd als minuten:seconden ("23:05"), voor een aftellende klok */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "1 mrt 2027" */
const embargoFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Afschermen en embargo voor waarneming.nl, kort: "Verborgen op
 * waarneming.nl · embargo tot 1 mrt 2027". Leeg als hij gewoon openbaar is.
 */
export function shieldText(obs: Pick<Observation, 'obscurity' | 'embargoUntil'>): string {
  const parts: string[] = [];
  if (obs.obscurity) parts.push(t('log.shielded', { what: t(`obscurity.${obs.obscurity}`) }));
  if (obs.embargoUntil) {
    const [y, m, d] = obs.embargoUntil.split('-').map(Number);
    const date = embargoFormat.format(new Date(y, m - 1, d));
    parts.push(parts.length ? t('log.embargoAfter', { date }) : t('log.embargo', { date }));
  }
  return parts.join(' · ');
}
