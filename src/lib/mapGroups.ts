import type { Observation } from './db';
import { rarityOf } from './rarity';

// Groeperen en samenvatten van waarnemingen voor de kaart
// (ObservationMap.svelte). Los van Leaflet, zodat het te testen is.

/** Tot zoveel waarnemingen opent een cluster meteen als lijst; daarboven inzoomen */
export const CLUSTER_LIST_MAX = 5;

/**
 * Waarnemingen uit dezelfde uitspraak delen een positie; die komen samen in
 * één stip, anders liggen ze precies op elkaar. Stippen die alleen dicht bij
 * elkaar liggen, voegt de clusterlaag samen.
 */
export function groupByPosition(list: Observation[]): Observation[][] {
  const groups = new Map<string, Observation[]>();
  for (const obs of list) {
    if (!obs.position) continue;
    const key = `${obs.position.lat},${obs.position.lon}`;
    groups.set(key, [...(groups.get(key) ?? []), obs]);
  }
  return [...groups.values()];
}

/** Wat een stip of cluster laat zien: de zeldzaamste soort en of er iets onzekers in zit */
export function summarize(list: Observation[]): { rarity: number; uncertain: boolean } {
  return {
    rarity: Math.max(0, ...list.map((obs) => rarityOf(obs.speciesId))),
    uncertain: list.some((obs) => obs.uncertain),
  };
}

/**
 * Tik op een cluster: een klein cluster, of een dat niet verder uit elkaar
 * kan (hoogste zoomniveau), opent als lijst; een groot cluster zoomt in.
 */
export function clusterAction(count: number, canZoomIn: boolean): 'list' | 'zoom' {
  return count <= CLUSTER_LIST_MAX || !canZoomIn ? 'list' : 'zoom';
}

/** Op tijd, de oudste eerst */
export function byTime(list: Observation[]): Observation[] {
  return [...list].sort((a, b) => a.observedAt - b.observedAt);
}
