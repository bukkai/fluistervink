import { afterEach, describe, expect, it, vi } from 'vitest';
import { preferenceOn, preferenceSince, setPreference } from './preferences';

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

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

  it('weet sinds wanneer eBird aan staat', () => {
    expect(preferenceSince('ebird')).toBeUndefined();
    vi.useFakeTimers({ now: 1000 });
    setPreference('ebird', true);
    vi.setSystemTime(5000);
    expect(preferenceSince('ebird')).toBe(1000);
    setPreference('ebird', false);
    expect(preferenceSince('ebird')).toBeUndefined();
    expect(localStorage.length).toBe(0);
  });

  it('rekent vanaf nu als de keuze al aan stond voordat dat werd bijgehouden', () => {
    localStorage.setItem('fluistervink.pref.ebird', '1');
    vi.useFakeTimers({ now: 2000 });
    expect(preferenceSince('ebird')).toBe(2000);
    vi.setSystemTime(9000);
    expect(preferenceSince('ebird')).toBe(2000);
  });
});
