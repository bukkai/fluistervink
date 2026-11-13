import { describe, expect, it } from 'vitest';
import type { Observation } from './db';
import { byGroup, summarize } from './summary';
import { ATALANTA, HOUTDUIF, REE, VINK } from '../test-helpers';

function obs(speciesId: number, count: number, at: string): Observation {
  return {
    id: crypto.randomUUID(),
    sessionId: 'nu',
    utteranceId: 'u',
    speciesId,
    count,
    observedAt: Date.parse(at),
    createdAt: 0,
    uncertain: false,
    status: 'draft',
  };
}

describe('samenvatting van een sessie', () => {
  it('telt per soort op, meeste eerst', () => {
    const lines = summarize([
      obs(VINK, 2, '2026-11-12T09:00'),
      obs(HOUTDUIF, 6, '2026-11-12T09:05'),
      obs(VINK, 3, '2026-11-12T09:10'),
    ]);
    expect(lines.map((l) => [l.name, l.count])).toEqual([
      ['Houtduif', 6],
      ['Vink', 5],
    ]);
  });
});

describe('samenvatting per soortgroep', () => {
  it('vogels zonder kopje eerst, daarna de andere dieren per groep', () => {
    const lines = summarize([
      obs(ATALANTA, 1, '2026-11-12T09:00'),
      obs(REE, 2, '2026-11-12T09:05'),
      obs(VINK, 3, '2026-11-12T09:10'),
    ]);
    expect(byGroup(lines).map((g) => [g.title, g.lines.map((l) => l.name)])).toEqual([
      [undefined, ['Vink']],
      ['Zoogdieren', ['Ree']],
      ['Dagvlinders', ['Atalanta']],
    ]);
  });
});
