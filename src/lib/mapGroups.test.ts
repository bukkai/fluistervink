import { describe, expect, it } from 'vitest';
import type { Observation } from './db';
import { byTime, CLUSTER_LIST_MAX, clusterAction, groupByPosition, summarize } from './mapGroups';

// Soorten met een bekende zeldzaamheid uit data/soorten-nl.json
const ALGEMEEN = 2265;
const ZELDZAAM = 313;
const ONBEKEND = 18926;

function obs(id: string, extra: Partial<Observation> = {}): Observation {
  return {
    id,
    sessionId: 's',
    utteranceId: 'u',
    speciesId: ALGEMEEN,
    count: 1,
    observedAt: 0,
    createdAt: 0,
    position: { lat: 52, lon: 5, accuracy: 10, fixedAt: 0 },
    uncertain: false,
    status: 'draft',
    ...extra,
  } as Observation;
}

describe('kaartgroepen', () => {
  it('voegt alleen precies dezelfde positie samen en slaat waarnemingen zonder positie over', () => {
    const nearby = { lat: 52.00001, lon: 5, accuracy: 10, fixedAt: 0 };
    const groups = groupByPosition([
      obs('a'),
      obs('b'),
      obs('c', { position: nearby }),
      obs('d', { position: undefined }),
    ]);
    expect(groups.map((group) => group.map((o) => o.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('neemt de zeldzaamste soort en ziet onzeker in het hele cluster', () => {
    expect(summarize([obs('a'), obs('b', { speciesId: ZELDZAAM, uncertain: true })])).toEqual({
      rarity: 3,
      uncertain: true,
    });
    expect(summarize([obs('a', { speciesId: ONBEKEND })])).toEqual({
      rarity: 0,
      uncertain: false,
    });
  });

  it('opent een klein cluster als lijst en zoomt in op een groot', () => {
    expect(clusterAction(CLUSTER_LIST_MAX, true)).toBe('list');
    expect(clusterAction(CLUSTER_LIST_MAX + 1, true)).toBe('zoom');
  });

  it('opent een groot cluster als lijst als inzoomen niet meer kan', () => {
    expect(clusterAction(20, false)).toBe('list');
  });

  it('sorteert op tijd zonder de lijst zelf te veranderen', () => {
    const list = [obs('b', { observedAt: 2 }), obs('a', { observedAt: 1 })];
    expect(byTime(list).map((o) => o.id)).toEqual(['a', 'b']);
    expect(list[0].id).toBe('b');
  });
});
