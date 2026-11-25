import { describe, expect, it } from 'vitest';
import type { Tester } from './api';
import type { SummaryRow } from './stats';
import {
  asOwner,
  inTestPhase,
  leftoverNames,
  lastSeen,
  ownInstalls,
  splitActive,
  testPhaseNames,
  withoutTestPhase,
} from './testers';

const now = Date.parse('2026-11-11T12:00:00Z');
const daysAgo = (n: number) => now - n * 24 * 60 * 60 * 1000;
const tester = (name: string, extra: Partial<Tester> = {}): Tester => ({
  name,
  source: 'install',
  ...extra,
});

describe('lijst met installaties', () => {
  it('neemt het laatste van gebruik, gedeelde sessies en aanmelden', () => {
    expect(
      lastSeen(
        tester('a', {
          invitedAt: daysAgo(60),
          lastUsed: '2026-11-01',
          usage: { sessions: 1, utterances: 3, notes: 0, lastActivity: daysAgo(20) },
        }),
      ),
    ).toBe(Date.parse('2026-11-01T12:00:00Z'));
    expect(lastSeen(tester('b'))).toBeUndefined();
  });

  it('zet recent gebruikte installaties bovenaan en de rest apart', () => {
    const shared = { sessions: 1, utterances: 3, notes: 0 };
    const { active, inactive } = splitActive(
      [
        tester('oud', { invitedAt: daysAgo(90), lastUsed: '2026-09-01', usage: shared }),
        tester('nieuw', { invitedAt: daysAgo(2), usage: shared }),
        tester('vandaag', { invitedAt: daysAgo(90), lastUsed: '2026-11-11', usage: shared }),
        tester('niets gedeeld', { invitedAt: daysAgo(1), lastUsed: '2026-11-11' }),
        tester('afgesloten', { invitedAt: daysAgo(1), blocked: true, usage: shared }),
        tester('onbekend'),
      ],
      now,
    );
    expect(active.map((t) => t.name)).toEqual(['vandaag', 'nieuw']);
    expect(inactive.map((t) => t.name)).toEqual(['niets gedeeld', 'afgesloten', 'oud', 'onbekend']);
  });
});

describe('installaties van de eigenaar', () => {
  const testers = [
    { name: 'app-11111111', source: 'install', owner: true },
    { name: 'app-22222222', source: 'install' },
  ] as Tester[];

  it('telt hun verbruik als dat van de eigenaar', () => {
    const own = ownInstalls(testers);
    expect([...own]).toEqual(['app-11111111']);
    const rows = [
      { tester: 'app-11111111', day: '2026-11-01' },
      { tester: 'app-22222222', day: '2026-11-01' },
    ];
    expect(asOwner(rows, own).map((r) => r.tester)).toEqual(['eigenaar', 'app-22222222']);
    // De rijen zelf blijven zoals ze waren
    expect(rows[0].tester).toBe('app-11111111');
  });

  it('zet ze bij de rest, niet bij de actieve', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    const used = { sessions: 1, utterances: 1, notes: 0, lastActivity: now };
    const { active, inactive } = splitActive(
      testers.map((t) => ({ ...t, usage: used })),
      now,
    );
    expect(active.map((t) => t.name)).toEqual(['app-22222222']);
    expect(inactive.map((t) => t.name)).toEqual(['app-11111111']);
  });
});

describe('testfase (schone lei bij de productierelease)', () => {
  const launch = '2026-12-03';
  const at = (day: string) => Date.parse(`${day}T12:00:00Z`);

  it('rekent wie zich vóór de release aanmeldde tot de testfase, de eigenaar niet', () => {
    expect(inTestPhase(tester('a', { invitedAt: at('2026-11-17') }), launch)).toBe(true);
    expect(inTestPhase(tester('b', { invitedAt: at('2026-12-03') }), launch)).toBe(false);
    expect(inTestPhase(tester('c'), launch)).toBe(true);
    expect(inTestPhase(tester('d', { invitedAt: at('2026-11-01'), owner: true }), launch)).toBe(
      false,
    );
  });

  it('heeft geen testfase zolang er geen productiedatum is', () => {
    expect(inTestPhase(tester('a', { invitedAt: at('2026-11-17') }), undefined)).toBe(false);
    expect(
      testPhaseNames(
        [{ day: '2026-11-20', tester: 'a', sessions: 1, utterances: 3 }],
        [],
        undefined,
      ).size,
    ).toBe(0);
  });

  it('neemt ook wie al vóór de release insprak, zonder de eigenaar', () => {
    const names = testPhaseNames(
      [
        { day: '2026-11-20', tester: 'oude-code', sessions: 1, utterances: 3 },
        { day: '2026-11-20', tester: 'eigenaar', sessions: 1, utterances: 3 },
        { day: '2026-12-05', tester: 'nieuw', sessions: 1, utterances: 3 },
      ],
      [
        tester('tester', { invitedAt: at('2026-11-17') }),
        tester('nieuw', { invitedAt: at('2026-12-04') }),
      ],
      launch,
    );
    expect([...names].sort()).toEqual(['oude-code', 'tester']);
  });

  it('zet testers die sinds de release niets deden bij de rest op Developer', () => {
    const shared = { sessions: 1, utterances: 3, notes: 0 };
    const { active } = splitActive(
      [
        tester('tester', { invitedAt: daysAgo(20), lastUsed: '2026-11-01', usage: shared }),
        tester('nieuw', { invitedAt: daysAgo(1), lastUsed: '2026-11-11', usage: shared }),
      ],
      now,
      '2026-11-05',
    );
    expect(active.map((t) => t.name)).toEqual(['nieuw']);
  });

  it('zet een tester die na de release doorgaat gewoon bij de actieven', () => {
    const shared = { sessions: 1, utterances: 3, notes: 0 };
    const { active } = splitActive(
      [tester('tester', { invitedAt: daysAgo(20), lastUsed: '2026-11-10', usage: shared })],
      now,
      '2026-11-05',
    );
    expect(active.map((t) => t.name)).toEqual(['tester']);
  });

  it('laat Statistieken alleen de testers weglaten die na de release stopten', () => {
    const left = leftoverNames(
      [
        { day: '2026-11-20', tester: 'gestopt', sessions: 1, utterances: 3 },
        { day: '2026-11-20', tester: 'door', sessions: 1, utterances: 3 },
        { day: '2026-12-10', tester: 'door', sessions: 1, utterances: 3 },
      ],
      new Set(['gestopt', 'door', 'nooit']),
      launch,
    );
    expect([...left].sort()).toEqual(['gestopt', 'nooit']);
    expect(leftoverNames([], new Set(['a']), undefined).size).toBe(0);
  });

  it('laat anonieme cijfers van vóór de week van de release weg', () => {
    const row = (cohort: string) => ({ cohort }) as SummaryRow;
    const kept = withoutTestPhase(
      [row('2026-11-16'), row(''), row('2026-11-30'), row('2026-12-07')],
      launch,
    );
    expect(kept.map((r) => r.cohort)).toEqual(['2026-11-30', '2026-12-07']);
    expect(withoutTestPhase([row('2026-11-16')], undefined)).toHaveLength(1);
  });
});
