// Samenvatting van een sessie (instelling, standaard aan, preferences.ts): welke soorten
// met hoeveel, en welke dit jaar voor het eerst op deze telefoon. Thuis meer
// waarde dan alleen exporteren.

import { db, type Observation, type Session } from './db';
import { getSpecies, speciesName } from './vocab';

export interface SummaryLine {
  speciesId: number;
  name: string;
  /** Opgeteld over alle waarnemingen van deze soort */
  count: number;
  /** Dit kalenderjaar niet eerder gezien (op deze telefoon) */
  newThisYear: boolean;
}

/**
 * `earlier`: waarnemingen uit andere sessies. Verzamelsoorten ("Eend
 * onbekend") staan in de lijst, maar zijn nooit nieuw.
 */
export function summarize(observations: Observation[], earlier: Observation[]): SummaryLine[] {
  const first = Math.min(...observations.map((obs) => obs.observedAt));
  const yearStart = new Date(new Date(first).getFullYear(), 0, 1).getTime();
  const seen = new Set(
    earlier
      .filter((obs) => obs.observedAt >= yearStart && obs.observedAt < first)
      .map((obs) => obs.speciesId),
  );
  const lines = new Map<number, SummaryLine>();
  for (const obs of observations) {
    const line = lines.get(obs.speciesId);
    if (line) {
      line.count += obs.count;
      continue;
    }
    lines.set(obs.speciesId, {
      speciesId: obs.speciesId,
      name: speciesName(obs.speciesId),
      count: obs.count,
      newThisYear: getSpecies(obs.speciesId)?.type !== 'M' && !seen.has(obs.speciesId),
    });
  }
  // Meeste exemplaren eerst; bij gelijk op naam
  return [...lines.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'nl'),
  );
}

/** Samenvatting van een sessie, met de waarnemingen van alle andere sessies */
export async function sessionSummary(session: Session): Promise<SummaryLine[]> {
  const all = await db.observations.toArray();
  const own = all.filter((obs) => obs.sessionId === session.id);
  if (!own.length) return [];
  return summarize(
    own,
    all.filter((obs) => obs.sessionId !== session.id),
  );
}
