import { fetchArea, type Area } from './api';
import { db, type Position, type SessionPlace } from './db';
import { logEvent } from './log';

// Gebiedsnaam bij een uitspraak en de waarnemingen eruit: het gebied van
// waarneming.nl ("Noordhollands Duinreservaat - Meeuwenlekken"). Wordt
// opgezocht zodra de positie bekend is. Lukt dat niet (geen verbinding), dan
// blijft het veld leeg en volgt een nieuwe poging bij het openen van de wandeling.

/**
 * Zoekt het gebied op en zet het bij de uitspraak en zijn waarnemingen.
 * Geeft false terug als het opzoeken mislukte.
 */
export async function attachArea(utteranceId: string, position: Position): Promise<boolean> {
  let area;
  try {
    area = await fetchArea(position.lat, position.lon);
  } catch (error) {
    logEvent('area_error', { message: (error as Error).message }, { utteranceId });
    return false;
  }
  await db.transaction('rw', db.utterances, db.observations, async () => {
    await db.utterances.update(utteranceId, { area });
    await db.observations
      .where('utteranceId')
      .equals(utteranceId)
      .filter((obs) => obs.area === undefined)
      .modify({ area });
  });
  // Startpositie niet gevonden (GPS of verbinding traag)? Dan de eerste uitspraak
  const utterance = await db.utterances.get(utteranceId);
  if (area && utterance) await setPlace(utterance.sessionId, area, 'start');
  return true;
}

let filling = false;

/**
 * Zoekt alsnog de gebieden op die nog ontbreken, bv. na een uitspraak zonder
 * verbinding of bij wandelingen van vóór deze functie. Eén voor één.
 */
export async function fillMissingAreas(sessionId: string): Promise<void> {
  if (filling) return;
  filling = true;
  try {
    const missing = await db.utterances
      .where('sessionId')
      .equals(sessionId)
      .filter((u) => u.position !== undefined && u.area === undefined)
      .toArray();
    for (const u of missing) {
      // Mislukt er één (geen verbinding), dan de rest ook; volgende keer verder
      if (!(await attachArea(u.id, u.position!))) break;
    }
    // Bv. gestopt zonder verbinding, of een wandeling van vóór deze functie
    const session = await db.sessions.get(sessionId);
    if (session?.status === 'ended') await nameFromWalk(sessionId);
  } finally {
    filling = false;
  }
}

// Naam van de wandeling. Bij het starten het gebied van de startpositie, als
// voorlopige naam. Bij het stoppen het gebied met de meeste waarnemingen: dat
// is meestal waar je echt gewandeld hebt (start je in een woonwijk, dan wint
// het natuurgebied verderop). Een zelf ingevulde naam blijft altijd staan.

/** "Arnhem - Heijenoord/Lombok (14)" → "Arnhem - Heijenoord/Lombok" */
export function placeName(area: Area): string {
  return area.name.replace(/\s*\(\d+\)$/, '');
}

/**
 * Zet de naam, tenzij er al een betere staat: een zelf ingevulde naam gaat
 * altijd voor, en een startnaam overschrijft geen naam van de hele wandeling.
 */
async function setPlace(sessionId: string, area: Area, source: 'start' | 'walk') {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return;
    const current = session.place?.source;
    if (current === 'hand' || (source === 'start' && current)) return;
    const place: SessionPlace = { name: placeName(area), areaId: area.id, source };
    await db.sessions.update(sessionId, { place });
  });
}

/**
 * Voorlopige naam bij het starten, uit de positie op dat moment. Mislukt het,
 * dan volgt de naam uit de eerste uitspraak met een gebied (zie `attachArea`).
 */
export async function nameFromStart(sessionId: string, position: Position): Promise<void> {
  try {
    const area = await fetchArea(position.lat, position.lon);
    if (area) await setPlace(sessionId, area, 'start');
  } catch (error) {
    logEvent('area_error', { message: (error as Error).message }, { sessionId });
  }
}

/**
 * Naam bij het stoppen: het gebied met de meeste waarnemingen. Bij een gelijke
 * stand het gebied dat het eerst voorkwam. Zonder waarnemingen met een gebied
 * blijft de startnaam staan.
 */
export async function nameFromWalk(sessionId: string): Promise<void> {
  const observations = await db.observations.where('sessionId').equals(sessionId).sortBy('observedAt');
  const counts = new Map<number, { area: Area; count: number }>();
  for (const { area } of observations) {
    if (!area) continue;
    const entry = counts.get(area.id) ?? { area, count: 0 };
    entry.count++;
    counts.set(area.id, entry);
  }
  let best: { area: Area; count: number } | undefined;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  if (best) await setPlace(sessionId, best.area, 'walk');
}

/** Zelf ingevulde naam; leeg = weer automatisch bepalen. */
export async function renameSession(sessionId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed) {
    await db.sessions.update(sessionId, { place: { name: trimmed, source: 'hand' } });
    return;
  }
  await db.sessions.update(sessionId, { place: undefined });
  await nameFromWalk(sessionId);
}
