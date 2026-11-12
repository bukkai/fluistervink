import { afterEach, describe, expect, it } from 'vitest';
import { preferenceOn, setPreference } from './preferences';

afterEach(() => localStorage.clear());

describe('preferences', () => {
  it('staat standaard aan, behalve eBird', () => {
    expect(preferenceOn('samenvatting')).toBe(true);
    expect(preferenceOn('ebird')).toBe(false);
  });

  it('onthoudt een keuze die afwijkt van de standaard', () => {
    setPreference('samenvatting', false);
    setPreference('ebird', true);
    expect(preferenceOn('samenvatting')).toBe(false);
    expect(preferenceOn('ebird')).toBe(true);
  });

  it('bewaart niets als de keuze weer de standaard is', () => {
    setPreference('samenvatting', false);
    setPreference('samenvatting', true);
    setPreference('ebird', true);
    setPreference('ebird', false);
    expect(localStorage.length).toBe(0);
    expect(preferenceOn('ebird')).toBe(false);
  });

  it('leest een eerder bewaarde "uit" nog steeds als uit', () => {
    localStorage.setItem('fluistervink.pref.exportHerinnering', '0');
    expect(preferenceOn('exportHerinnering')).toBe(false);
  });
});
