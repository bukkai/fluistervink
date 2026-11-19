import { devOptionOn } from './devOptions';

// Land van de soortenlijst (docs/plan-andere-landen.md): welke vogels de app
// verwacht en hoe zeldzaam ze zijn. Voorlopig alleen Nederland, en Spanje
// achter de ontwikkeloptie "Spanje" (proef). Net als de taal staat het land
// vast zolang de app draait: wisselen laadt de app opnieuw.

/** Code van het land, zoals in data/soorten-<code>.json */
export type Region = 'nl' | 'es';

export const region: Region = devOptionOn('spanje') ? 'es' : 'nl';
