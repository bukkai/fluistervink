import { describe, expect, it } from 'vitest';
import type { Observation, Utterance } from './db';
import { voiceOriginals } from './observations';

// Merkje "met de stem aangepast" bij het nalopen: een correctie kan op de
// verkeerde waarneming landen (trektelling 19 nov), dus hij moet opvallen.

const HOLENDUIF = 118;
const WULP = 52;

function obs(id: string, fields: Partial<Observation>): Observation {
  return {
    id,
    sessionId: 's',
    utteranceId: 'u0',
    speciesId: WULP,
    count: 3,
    observedAt: 0,
    createdAt: 0,
    uncertain: false,
    status: 'draft',
    ...fields,
  };
}

function utterance(id: string, recordedAt: number, fields: Partial<Utterance>): Utterance {
  return { id, sessionId: 's', recordedAt, status: 'done', ...fields };
}

const correction = (id: string, at: number, before: Partial<Observation>, extra = {}) =>
  utterance(id, at, {
    changes: [{ type: 'update', observationId: 'a', before }],
    ...extra,
  });

describe('met de stem aangepast', () => {
  it('geeft hoe de waarneming was vóór de correctie', () => {
    const originals = voiceOriginals(
      [correction('u1', 10, { speciesId: HOLENDUIF, uncertain: true })],
      [obs('a', {}), obs('b', {})],
    );
    expect([...originals.keys()]).toEqual(['a']);
    expect(originals.get('a')).toMatchObject({ speciesId: HOLENDUIF, count: 3 });
  });

  it('na meer correcties: hoe hij oorspronkelijk was, ook als de uitspraken door elkaar staan', () => {
    const originals = voiceOriginals(
      // Nieuwste eerst, zoals listUtterances ze geeft
      [correction('u2', 20, { count: 3 }), correction('u1', 10, { speciesId: HOLENDUIF })],
      [obs('a', { count: 5 })],
    );
    expect(originals.get('a')).toMatchObject({ speciesId: HOLENDUIF, count: 3 });
  });

  it('niet bij een teruggedraaide correctie, of als hij weer is zoals eerst', () => {
    expect(
      voiceOriginals(
        [correction('u1', 10, { speciesId: HOLENDUIF }, { undone: true })],
        [obs('a', {})],
      ).size,
    ).toBe(0);
    expect(
      voiceOriginals(
        [correction('u1', 10, { count: 2 }), correction('u2', 20, { count: 3 })],
        [obs('a', { count: 2 })],
      ).size,
    ).toBe(0);
  });

  it('niet bij alleen een plek, opmerking of "onzeker"', () => {
    const originals = voiceOriginals(
      [correction('u1', 10, { remarks: undefined, uncertain: true, spokenPlace: undefined })],
      [obs('a', { remarks: 'ringkleur geel' })],
    );
    expect(originals.size).toBe(0);
  });
});
