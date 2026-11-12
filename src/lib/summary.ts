// Samenvatting van een sessie (instelling, standaard aan, preferences.ts): welke
// soorten met hoeveel. Bewust zonder "nieuw dit jaar" (weggehaald 12 nov): de
// app is er niet om soorten te verzamelen, dat doet waarneming.nl.

import { db, type Observation, type Session } from './db';
import { speciesName } from './vocab';

export interface SummaryLine {
  speciesId: number;
  name: string;
  /** Opgeteld over alle waarnemingen van deze soort */
  count: number;
}

export function summarize(observations: Observation[]): SummaryLine[] {
  const lines = new Map<number, SummaryLine>();
  for (const obs of observations) {
    const line = lines.get(obs.speciesId);
    if (line) line.count += obs.count;
    else
      lines.set(obs.speciesId, {
        speciesId: obs.speciesId,
        name: speciesName(obs.speciesId),
        count: obs.count,
      });
  }
  // Meeste exemplaren eerst; bij gelijk op naam
  return [...lines.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'nl'),
  );
}

/** Samenvatting van een sessie */
export async function sessionSummary(session: Session): Promise<SummaryLine[]> {
  return summarize(await db.observations.where('sessionId').equals(session.id).toArray());
}
