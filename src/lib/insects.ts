// Insecten inspreken (docs/plan-insecten.md, laag 1). De volledige lijsten
// (ruim 4000 soorten, data/soorten-insecten.json) zitten in een eigen bestand
// dat de app pas laadt als het nodig is, zodat hij niet trager start. De
// service worker bewaart het, dus het werkt ook offline.
//
// - Met de ontwikkeloptie `insecten` en de keuze "Ook andere dieren inspreken"
//   laadt main.ts de lijst vóór de app op het scherm komt, en gaan de
//   verzamelsoorten ("Kever onbekend") naar het model (`setInsectsEnabled`).
// - Anders laadt hij later op de achtergrond, alleen om de namen van eerder
//   ingesproken insecten te tonen en te exporteren.

import { devOptionOn } from './devOptions';
import { logEvent } from './log';
import { preferenceOn } from './preferences';
import { insectsLoaded, registerInsects, setInsectsEnabled, type InsectSpecies } from './vocab';

let loading: Promise<void> | undefined;

/** Laadt de volledige insectenlijsten (één keer) en meldt ze aan in vocab.ts */
export function loadInsects(): Promise<void> {
  loading ??= import('../../data/soorten-insecten.json')
    .then((module) => registerInsects(module.default as InsectSpecies[]))
    .catch((error: unknown) => {
      // Een volgende keer opnieuw proberen
      loading = undefined;
      logEvent('insects_load_failed', { message: (error as Error).message });
      throw error;
    });
  return loading;
}

/** Wil de gebruiker insecten inspreken? */
export function insectsWanted(): boolean {
  return devOptionOn('insecten') && preferenceOn('soortgroepen');
}

/**
 * Zet de insecten aan of uit naar de keuzes (bij het opstarten en na een
 * wijziging bij Instellingen). Aan pas als de lijst geladen is: anders kan het
 * model "Kever onbekend" kiezen terwijl de app de soortnaam niet kan opzoeken.
 */
export async function syncInsects(): Promise<void> {
  if (!insectsWanted()) {
    setInsectsEnabled(false);
    return;
  }
  try {
    if (!insectsLoaded()) await loadInsects();
    setInsectsEnabled(insectsWanted());
  } catch {
    setInsectsEnabled(false);
  }
}
