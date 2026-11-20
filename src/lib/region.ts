import { devOptionOn } from './devOptions';

// Land van de soortenlijst (docs/plan-andere-landen.md): welke vogels de app
// verwacht en hoe zeldzaam ze zijn. In de app voorlopig alleen Nederland.
// Spanje staat achter de ontwikkeloptie "Spanje" (proef van 19 nov, het
// vinkje is weg; de testset gebruikt hem met `--land es`). Net als de taal
// staat het land vast zolang de app draait. Later hoort het land bij de
// sessie (plan, "Schaalbaar").

/** Code van het land, zoals in data/soorten-<code>.json */
export type Region = 'nl' | 'es';

export const region: Region = devOptionOn('spanje') ? 'es' : 'nl';
