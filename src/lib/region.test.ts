import { describe, expect, it, vi } from 'vitest';

// Ontwikkeloptie "Spanje" aan vóór de modules laden: het land staat vast
// zolang de app draait (region.ts). Elk testbestand heeft zijn eigen context,
// dus de andere tests blijven Nederlands.
vi.hoisted(() => localStorage.setItem('fluistervink.dev.spanje', '1'));

import spainList from '../../data/soorten-es.json';
import { rarityOf } from './rarity';
import { region } from './region';
import {
  BIRDS,
  findPromptSpecies,
  findVagrant,
  getSpecies,
  isPromptSpecies,
  isVagrant,
  promptSpeciesOf,
  species,
  speciesListsFor,
} from './vocab';

const BIJENETER = 1386;
const BLAUWE_EKSTER = 1619;
const RODE_PATRIJS = 809;
const MONNIKSPARKIET = 1681;
const DUPONTS_LEEUWERIK = 77687;
const EEND_ONBEKEND = 240802;

describe('Spanje (ontwikkeloptie)', () => {
  it('leest het land uit de ontwikkeloptie', () => {
    expect(region).toBe('es');
  });

  it('heeft de typische Spaanse soorten in de prompt, als gewone soort', () => {
    for (const id of [BIJENETER, BLAUWE_EKSTER, RODE_PATRIJS]) {
      expect(isPromptSpecies(id)).toBe(true);
      expect(rarityOf(id)).toBeLessThanOrEqual(2);
      expect(isVagrant(id)).toBe(false);
    }
    expect(findPromptSpecies('bijeneter')?.id).toBe(BIJENETER);
  });

  it('neemt een gevestigde exoot op', () => {
    expect(getSpecies(MONNIKSPARKIET)?.name).toBe('Monniksparkiet');
    expect(isPromptSpecies(MONNIKSPARKIET)).toBe(true);
  });

  it('houdt de prompt ongeveer zo groot als die van Nederland', () => {
    const dutch = speciesListsFor('nl').prompt.filter((s) => s.group === BIRDS);
    expect(species.length).toBeGreaterThan(300);
    expect(species.length).toBeLessThan(dutch.length * 1.5);
  });

  it('houdt de andere diergroepen van Nederland', () => {
    const dutchMammals = speciesListsFor('nl').prompt.filter((s) => s.group === 2);
    expect(promptSpeciesOf(2)).toEqual(dutchMammals);
  });

  it('vindt een zeer zeldzame Spaanse soort als dwaalgast', () => {
    expect(isPromptSpecies(DUPONTS_LEEUWERIK)).toBe(false);
    expect(isVagrant(DUPONTS_LEEUWERIK)).toBe(true);
    expect(findVagrant('duponts leeuwerik')?.id).toBe(DUPONTS_LEEUWERIK);
  });

  it('houdt de verzamelsoorten van de Nederlandse prompt, zonder zeldzaamheid', () => {
    expect(isPromptSpecies(EEND_ONBEKEND)).toBe(true);
    expect(rarityOf(EEND_ONBEKEND)).toBe(0);
  });

  it('kent een Nederlandse vogel die niet op de Spaanse lijst staat nog wel, zonder zeldzaamheid', () => {
    const esIds = new Set(spainList.map((s) => s.id));
    const dutchOnly = speciesListsFor('nl').all.find((s) => s.group === BIRDS && !esIds.has(s.id));
    if (!dutchOnly) return; // de Spaanse lijst kan ze ook allemaal hebben
    expect(getSpecies(dutchOnly.id)?.name).toBe(dutchOnly.name);
    expect(rarityOf(dutchOnly.id)).toBe(0);
    expect(isVagrant(dutchOnly.id)).toBe(false);
  });
});
