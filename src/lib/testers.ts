import type { Tester } from './api';

// De lijst met installaties op Developer: wie de laatste tijd actief was
// bovenaan, de rest achter "Toon meer".

/** Zo lang na het laatste gebruik (of het aanmelden) telt een installatie als actief */
export const ACTIVE_DAYS = 30;

/** Laatst gezien: de laatste uitspraak (verbruik of gedeeld), anders het aanmelden. */
export function lastSeen(tester: Tester): number | undefined {
  const times = [
    tester.lastUsed ? Date.parse(`${tester.lastUsed}T12:00:00Z`) : undefined,
    tester.usage?.lastActivity,
    tester.invitedAt,
  ].filter((t): t is number => t !== undefined && !Number.isNaN(t));
  return times.length ? Math.max(...times) : undefined;
}

/**
 * Actieve installaties (niet afgesloten, iets gedeeld, en gezien in de laatste
 * `ACTIVE_DAYS` dagen), en de rest; allebei met de laatst geziene bovenaan.
 * Wie nog niets deelde staat ook bij de rest: daar valt voor de eigenaar
 * (nog) niets aan te zien.
 */
export function splitActive(testers: Tester[], now = Date.now()) {
  const since = now - ACTIVE_DAYS * 24 * 60 * 60 * 1000;
  const sorted = [...testers].sort((a, b) => (lastSeen(b) ?? 0) - (lastSeen(a) ?? 0));
  const isActive = (t: Tester) =>
    !t.blocked && t.usage !== undefined && (lastSeen(t) ?? 0) >= since;
  return { active: sorted.filter(isActive), inactive: sorted.filter((t) => !isActive(t)) };
}
