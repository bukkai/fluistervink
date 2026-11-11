import { beforeEach, describe, expect, it } from 'vitest';
import { versionChange } from './updateMelding.svelte';

// Melding "Bijgewerkt naar versie …" alleen na een echte update

beforeEach(() => localStorage.clear());

describe('versionChange', () => {
  it('meldt niets bij de eerste keer openen', () => {
    expect(versionChange(localStorage, 'abc1234')).toBe('');
  });

  it('meldt niets als de versie gelijk blijft', () => {
    versionChange(localStorage, 'abc1234');
    expect(versionChange(localStorage, 'abc1234')).toBe('');
  });

  it('meldt de nieuwe versie één keer', () => {
    versionChange(localStorage, 'abc1234');
    expect(versionChange(localStorage, 'def5678')).toBe('def5678');
    expect(versionChange(localStorage, 'def5678')).toBe('');
  });
});
