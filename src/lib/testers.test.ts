import { describe, expect, it } from 'vitest';
import type { Tester } from './api';
import { asOwner, lastSeen, ownInstalls, splitActive } from './testers';

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
