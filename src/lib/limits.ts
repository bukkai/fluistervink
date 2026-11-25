// Plafonds per installatie per dag in de proxy (worker/index.ts), hier zodat
// Developer kan laten zien hoe dicht gebruikers erbij komen. De eigenaar valt
// erbuiten (testset).

/**
 * Spraakherkenning (docs/plan-trektelmodus.md, punt 5): een trektelling houdt de
 * microfoon uren aan, en sinds aanmelden zonder code kan iedereen de app
 * installeren. Vijf uur spraak is een hele dag tellen; met de knop haal je dat
 * nooit.
 */
export const AUDIO_SECONDS_PER_DAY = 5 * 60 * 60;

/**
 * Verzoeken aan het model. De drukste dag vogelen tot nu toe had 99 uitspraken
 * (13 nov, Terschelling), een trektelling van 5 uur (het plafond voor spraak)
 * hooguit 300 stukken; elke uitspraak is één verzoek. Zonder dit plafond hield
 * alleen de grens van 60 per minuut een misbruikte installatie tegen, en dat kon
 * honderden dollars per dag kosten; nu hooguit zo'n $3,30 (500 × 256 kB aan
 * invoer). Was 1500 tijdens de gesloten test; verlaagd voor de openbare app
 * (`docs/plan-marketing.md`, Kostengrens per stap).
 */
export const MESSAGES_PER_DAY = 500;

// Grenzen voor alle installaties samen (worker/guard.ts). De plafonds per
// installatie houden één misbruikte installatie tegen, maar wie er veel
// aanmaakte, kreeg tot 25 nov voor elk een eigen dag. De eigenaar valt erbuiten.

/**
 * Kosten per dag van alle installaties samen, in dollars, over beta en stable.
 * Gebruikers kostten tot 24 nov hooguit $0,15 op een dag. Daarboven wachten
 * uitspraken tot de volgende dag (503, zoals bij geen bereik). In te stellen
 * met de var `DAILY_BUDGET_USD`.
 */
export const DAILY_BUDGET_USD = 5;

/** Nieuwe installaties per uur en per dag, voor alle omgevingen samen. */
export const NEW_INSTALLS_PER_HOUR = 30;
export const NEW_INSTALLS_PER_DAY = 150;

/**
 * Delen per dag: per installatie (een trektelling van 4 uur met opnames is
 * ~75 MB) en alle installaties samen. Wat erboven komt, deelt de app later
 * (share.ts probeert het opnieuw).
 */
export const SHARED_BYTES_PER_INSTALL_PER_DAY = 250 * 1024 * 1024;
export const SHARED_BYTES_PER_DAY = 2 * 1024 * 1024 * 1024;

/**
 * Gebieden van waarneming.nl opzoeken per installatie per dag (`/api/area`,
 * de proxy is het doorgeefluik). Eén per uitspraak of verzette plek; een
 * trektelling van een dag geeft er een paar honderd. Zonder grens kon iemand
 * met een token waarneming.nl via ons bestoken, en die kan de Worker dan
 * blokkeren, voor iedereen.
 */
export const AREA_LOOKUPS_PER_INSTALL_PER_DAY = 1000;

/**
 * Anonieme cijfers per installatie per dag: één per sessie. Daarboven
 * bewaart de proxy ze niet, zodat één installatie Statistieken niet kan
 * volschrijven.
 */
export const SUMMARIES_PER_INSTALL_PER_DAY = 50;
