import { describe, expect, it, vi } from 'vitest';

// De app met de ontwikkeloptie "English" aan: de taal staat vast bij het laden
vi.mock('./devOptions', () => ({ devOptionOn: (option: string) => option === 'english' }));

const { LOCALE, language, t } = await import('./i18n');
const {
  activityLabel,
  allSpecies,
  countingMethodLabel,
  groupLabel,
  lifeStageLabel,
  methodLabel,
  searchSpecies,
  speciesLabel,
  speciesName,
} = await import('./vocab');

const ROE_DEER = 418;

describe('ontwikkeloptie English', () => {
  it('kiest Engels en en-GB', () => {
    expect(language).toBe('en');
    expect(LOCALE).toBe('en-GB');
    expect(t('home.title')).toBe('Ready to go birding?');
  });

  it('toont namen in het Engels, de gegevens blijven Nederlands', () => {
    expect(speciesLabel(127)).toBe('Brambling');
    expect(speciesName(127)).toBe('Keep');
    expect(activityLabel(127, 6)).toBe('flying over');
    expect(methodLabel(127, 49)).toBe('heard');
    expect(lifeStageLabel(127, 5)).toBe('juvenile');
    expect(countingMethodLabel(6)).toBe('estimated');
  });

  it('noemt de groep in het Engels', () => {
    expect(groupLabel(ROE_DEER)).toBe('mammals');
    expect(groupLabel(127)).toBeUndefined();
  });

  it('zoekt op de Engelse naam', () => {
    const names = (query: string) =>
      searchSpecies(allSpecies, query).map((s) => speciesLabel(s.id));
    expect(names('brambl')[0]).toBe('Brambling');
    expect(names('lapwing')).toContain('Northern Lapwing');
    // Nederlands vindt hij niet meer
    expect(names('keep')).not.toContain('Brambling');
  });
});
