import { describe, expect, it } from 'vitest';
import { t, translate } from './index';
import { en } from './en';
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
    for (const dictionary of [nl, en]) {
      for (const [key, entry] of Object.entries(dictionary)) {
        const texts = typeof entry === 'string' ? [entry] : [entry.one, entry.other];
        for (const text of texts) expect(text.trim(), key).not.toBe('');
      }
    }
  });
});

describe('Engels', () => {
  it('vertaalt met dezelfde parameters en meervoud', () => {
    expect(translate('en', 'home.title')).toBe('Ready to go birding?');
    expect(translate('en', 'common.sessions', { n: 1 })).toBe('1 session');
    expect(translate('en', 'common.sessions', { n: 0 })).toBe('0 sessions');
  });

  it('gebruikt in elke tekst dezelfde parameters als het Nederlands', () => {
    const params = (entry: string | { one: string; other: string }) =>
      [...(typeof entry === 'string' ? entry : entry.one + entry.other).matchAll(/\{(\w+)\}/g)]
        .map((m) => m[1])
        .filter((name, i, all) => all.indexOf(name) === i && name !== 'n')
        .sort();
    for (const key of Object.keys(nl) as (keyof typeof nl)[]) {
      expect(params(en[key]), key).toEqual(params(nl[key]));
    }
  });

  it('heeft het meervoud waar het Nederlands het heeft', () => {
    for (const key of Object.keys(nl) as (keyof typeof nl)[]) {
      expect(typeof en[key], key).toBe(typeof nl[key]);
    }
  });
});
