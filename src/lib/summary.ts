// Samenvatting van een sessie (instelling, standaard aan, preferences.ts): welke
// soorten met hoeveel. Bewust zonder "nieuw dit jaar" (weggehaald 12 nov): de
// app is er niet om soorten te verzamelen, dat doet waarneming.nl.

import { db, type Observation, type Session } from './db';
import { BIRDS, getGroup, groupOf, speciesName, type GroupId } from './vocab';

export interface SummaryLine {
  speciesId: number;
  name: string;
  /** Opgeteld over alle waarnemingen van deze soort */
  count: number;
}

/** De regels van één soortgroep; vogels zonder kopje */
export interface SummaryGroup {
  /** Leeg bij vogels */
  title?: string;
  lines: SummaryLine[];
}

/** Vogels eerst, daarna de andere dieren per groep (ontwikkeloptie 'soortgroepen') */
export function byGroup(lines: SummaryLine[]): SummaryGroup[] {
  const groups = new Map<GroupId, SummaryLine[]>();
  for (const line of lines) {
    const group = groupOf(line.speciesId);
    groups.set(group, [...(groups.get(group) ?? []), line]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([group, lines]) => ({
      ...(group !== BIRDS && { title: getGroup(group).name }),
      lines,
    }));
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
