import { describe, expect, it } from 'vitest';
import type { Action } from './interpret';
import {
  BUIZERD_ID,
  liferSpecies,
  makesBuizerd,
  mentionsLifer,
  saysTochEenBuizerd,
} from './eastereggs.svelte';

const add = (speciesId: number): Action => ({ type: 'add', fields: { speciesId, count: 1 } });
const update = (speciesId: number): Action => ({
  type: 'update',
  observationId: 'x',
  fields: { speciesId },
});

describe('#tocheenbuizerd (easter egg)', () => {
  it('herkent "toch een buizerd" en wat in die strekking', () => {
    for (const text of [
      'Toch een buizerd',
      'nee, het is toch maar een buizerd',
      'ach, gewoon een buizerd',
      'die wespendief was toch gewoon een buizerd',
      'buizerd toch',
      'hashtag toch een buizerd',
      '#tocheenbuizerd',
      'toch een buizert',
      "no, it's just a buzzard",
      'a buzzard after all',
    ])
      expect(saysTochEenBuizerd(text), text).toBe(true);
  });

  it('laat gewone buizerds met rust', () => {
    for (const text of [
      'buizerd',
      'nee, buizerd',
      'weer een buizerd',
      'twee buizerds overvliegend',
      'toch een wespendief',
      'ruigpootbuizerd',
      'Common Buzzard',
    ])
      expect(saysTochEenBuizerd(text), text).toBe(false);
  });

  it('wil een waarneming die een buizerd wordt', () => {
    expect(makesBuizerd([update(BUIZERD_ID)])).toBe(true);
    expect(makesBuizerd([add(BUIZERD_ID)])).toBe(true);
    expect(makesBuizerd([update(83)])).toBe(false);
    expect(makesBuizerd([{ type: 'undo' }])).toBe(false);
    expect(makesBuizerd([])).toBe(false);
  });
});

describe('lifer (easter egg)', () => {
  it('herkent het woord lifer', () => {
    for (const text of ['Lifer!', 'grauwe gors, een lifer', 'twee lifers vandaag', 'laifer'])
      expect(mentionsLifer(text), text).toBe(true);
  });

  it('niet midden in een ander woord', () => {
    for (const text of ['olifer', 'liferen', 'lijfeigene', 'vink'])
      expect(mentionsLifer(text), text).toBe(false);
  });

  it('neemt de eerste soort van de uitspraak', () => {
    expect(liferSpecies([{ type: 'undo' }, add(5), add(6)])).toBe(5);
    expect(liferSpecies([update(7)])).toBe(7);
    expect(liferSpecies([])).toBeUndefined();
  });
});
