import { describe, expect, it } from 'vitest';
import type { Tester } from './api';
import { activeAfter, hasActivity, isLeftover, isUnused, usedSince } from './unusedInstalls';

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

describe('testfase opruimen', () => {
  const launch = '2026-12-03';
  const before = Date.parse('2026-11-17T12:00:00Z');
  const shared = (day: string) => ({
    sessions: 1,
    utterances: 1,
    notes: 0,
    lastActivity: Date.parse(`${day}T12:00:00Z`),
  });

  it('ruimt testers op die sinds de release niets meer deden', () => {
    expect(isLeftover(tester({ invitedAt: before, lastUsed: '2026-11-20' }), launch)).toBe(true);
    expect(isLeftover(tester({ invitedAt: undefined }), launch)).toBe(true);
    expect(isLeftover(tester({ invitedAt: before, usage: shared('2026-11-30') }), launch)).toBe(
      true,
    );
  });

  it('laat doorgaande testers, nieuwe installaties, de eigenaar en afgesloten staan', () => {
    expect(isLeftover(tester({ invitedAt: before, lastUsed: '2026-12-03' }), launch)).toBe(false);
    expect(isLeftover(tester({ invitedAt: before, usage: shared('2027-01-10') }), launch)).toBe(
      false,
    );
    expect(isLeftover(tester({ invitedAt: Date.parse('2026-12-04T12:00:00Z') }), launch)).toBe(
      false,
    );
    expect(isLeftover(tester({ invitedAt: before, owner: true }), launch)).toBe(false);
    expect(isLeftover(tester({ invitedAt: before, blocked: true }), launch)).toBe(false);
  });

  it('ziet gebruik op of na een dag, en iets na het opruimen', () => {
    expect(usedSince(tester({ lastUsed: '2026-12-02' }), launch)).toBe(false);
    expect(usedSince(tester({ lastUsed: '2026-12-03' }), launch)).toBe(true);
    const hiddenAt = Date.parse('2027-03-05T10:00:00Z');
    expect(activeAfter(tester({ lastUsed: '2027-03-05' }), hiddenAt)).toBe(false);
    expect(activeAfter(tester({ lastUsed: '2027-03-06' }), hiddenAt)).toBe(true);
    expect(activeAfter(tester({ usage: shared('2027-03-05') }), hiddenAt)).toBe(true);
  });
});
