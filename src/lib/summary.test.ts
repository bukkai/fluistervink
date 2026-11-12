import { describe, expect, it } from 'vitest';
import type { Observation } from './db';
import { summarize } from './summary';
import { HOUTDUIF, VINK } from '../test-helpers';

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
