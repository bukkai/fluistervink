import { describe, expect, it } from 'vitest';
import { t } from './index';
import { nl } from './nl';

describe('t', () => {
  it('geeft de tekst bij een sleutel', () => {
    expect(t('home.title')).toBe('Klaar om te gaan vogelen?');
  });

  it('vult parameters in', () => {
    expect(t('app.since', { time: '14:32' })).toBe('Sinds 14:32');
    expect(t('format.durationHours', { h: 1, m: 5 })).toBe('1 u 5 min');
  });

  it('kiest enkel- of meervoud met n', () => {
    expect(t('common.sessions', { n: 1 })).toBe('1 sessie');
    expect(t('common.sessions', { n: 0 })).toBe('0 sessies');
    expect(t('common.sessions', { n: 3 })).toBe('3 sessies');
  });

  it('laat een vergeten parameter zichtbaar staan', () => {
    expect(t('app.since')).toBe('Sinds {time}');
  });

  it('heeft geen lege teksten', () => {
    for (const [key, entry] of Object.entries(nl)) {
      const texts = typeof entry === 'string' ? [entry] : [entry.one, entry.other];
      for (const text of texts) expect(text.trim(), key).not.toBe('');
    }
  });
});
