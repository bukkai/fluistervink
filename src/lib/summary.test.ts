import { describe, expect, it } from 'vitest';
import type { Observation } from './db';
import { summarize } from './summary';
import { HOUTDUIF, KEEP, VINK } from '../test-helpers';

const EEND_ONBEKEND = 2265; // verzamelsoort

function obs(speciesId: number, count: number, at: string, sessionId = 'nu'): Observation {
  return {
    id: crypto.randomUUID(),
    sessionId,
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
    const lines = summarize(
      [
        obs(VINK, 2, '2026-11-12T09:00'),
        obs(HOUTDUIF, 6, '2026-11-12T09:05'),
        obs(VINK, 3, '2026-11-12T09:10'),
      ],
      [],
    );
    expect(lines.map((l) => [l.name, l.count])).toEqual([
      ['Houtduif', 6],
      ['Vink', 5],
    ]);
  });

  it('nieuw dit jaar: niet eerder dit kalenderjaar, wel vorig jaar telt niet', () => {
    const lines = summarize(
      [obs(VINK, 1, '2027-01-02T09:00'), obs(KEEP, 1, '2027-01-02T09:05')],
      [obs(VINK, 1, '2027-01-01T10:00', 'eerder'), obs(KEEP, 1, '2026-12-30T10:00', 'eerder')],
    );
    expect(lines.find((l) => l.speciesId === VINK)?.newThisYear).toBe(false);
    expect(lines.find((l) => l.speciesId === KEEP)?.newThisYear).toBe(true);
  });

  it('een latere sessie maakt een soort niet "niet nieuw"', () => {
    const [line] = summarize(
      [obs(VINK, 1, '2026-11-12T09:00')],
      [obs(VINK, 1, '2026-11-20T09:00', 'later')],
    );
    expect(line.newThisYear).toBe(true);
  });

  it('een verzamelsoort is nooit nieuw', () => {
    const [line] = summarize([obs(EEND_ONBEKEND, 3, '2026-11-12T09:00')], []);
    expect(line.newThisYear).toBe(false);
  });
});
