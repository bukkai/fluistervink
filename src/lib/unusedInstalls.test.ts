import { describe, expect, it } from 'vitest';
import type { Tester } from './api';
import { hasActivity, isUnused } from './unusedInstalls';

const now = Date.parse('2026-11-24T12:00:00Z');
const hoursAgo = (n: number) => now - n * 60 * 60 * 1000;
const tester = (extra: Partial<Tester> = {}): Tester => ({
  name: 'app-3f9a2b1c',
  source: 'install',
  invitedAt: hoursAgo(48),
  ...extra,
});

describe('ongebruikte installaties', () => {
  it('ruimt op wat na een dag nog niets deed, ook van de eigenaar of afgesloten', () => {
    expect(isUnused(tester(), now)).toBe(true);
    expect(isUnused(tester({ owner: true }), now)).toBe(true);
    expect(isUnused(tester({ blocked: true }), now)).toBe(true);
  });

  it('laat staan wat iets deed, nog geen dag oud is, of geen aanmelddatum heeft', () => {
    expect(isUnused(tester({ lastUsed: '2026-11-20' }), now)).toBe(false);
    expect(isUnused(tester({ usage: { sessions: 0, utterances: 1, notes: 1 } }), now)).toBe(false);
    expect(isUnused(tester({ displayName: 'Kees' }), now)).toBe(false);
    expect(isUnused(tester({ invitedAt: hoursAgo(23) }), now)).toBe(false);
    expect(isUnused(tester({ invitedAt: undefined }), now)).toBe(false);
  });

  it('ziet een teken van leven in gebruik, delen of een naam', () => {
    expect(hasActivity(tester())).toBe(false);
    expect(hasActivity(tester({ lastUsed: '2026-11-20' }))).toBe(true);
  });
});
