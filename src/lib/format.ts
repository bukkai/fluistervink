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
