import { fetchArea } from './api';
import { db, type Position } from './db';
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
  } finally {
    filling = false;
  }
}
