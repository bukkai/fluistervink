import { describe, expect, it } from 'vitest';
import type { Tester } from './api';
import { lastSeen, splitActive } from './testers';

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
          usage: { walks: 1, utterances: 3, notes: 0, lastActivity: daysAgo(20) },
        }),
      ),
    ).toBe(Date.parse('2026-11-01T12:00:00Z'));
    expect(lastSeen(tester('b'))).toBeUndefined();
  });

  it('zet recent gebruikte installaties bovenaan en de rest apart', () => {
    const shared = { walks: 1, utterances: 3, notes: 0 };
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
