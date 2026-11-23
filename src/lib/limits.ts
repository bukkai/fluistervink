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
