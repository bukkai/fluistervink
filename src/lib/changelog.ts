// Wat er nieuw is, voor gebruikers: pagina #nieuw (src/lib/Changelog.svelte),
// gelinkt bij Instellingen en vanuit de melding na een update. Elke PR die
// iets zichtbaars verandert, zet hier een regel bij, in gewone taal: bovenaan
// onder de datum van de merge, bij het onderwerp waar hij bij hoort.
// Alleen wat voor iedereen geldt (geen ontwikkelopties of schermen van de
// eigenaar). De stabiele versie toont vanzelf alleen wat al in stable zit.
// Bij elke release naar stable worden de oudere dagen (vóór die van de vorige
// release) ingekort tot de hoofdzaken, zonder onderwerpen: `items`.

/** Onderwerpen, in de volgorde waarin ze op de pagina staan */
export const TOPICS = [
  'Inspreken',
  'Trektelling',
  'Nalopen',
  'Export',
  'Back-up',
  'Android-app',
  'Over de app',
] as const;

export type Topic = (typeof TOPICS)[number];

export interface ChangelogEntry {
  /** Datum van de merge, JJJJ-MM-DD */
  date: string;
  /** Per onderwerp de regels; de volgorde op de pagina komt uit TOPICS */
  topics?: Partial<Record<Topic, string[]>>;
  /** Ingekort tot de hoofdzaken, zonder onderwerpen (oudere dagen) */
  items?: string[];
}

// Bij de productierelease begonnen met een schone lijst: wat de testers zagen,
// staat in git (vóór de PR "Lanceringsdag").
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-12-03',
    items: [
      'Fluistervink staat in Google Play. Wat de app kan, lees je bij Uitleg.',
      'Dank je wel aan de testers van de afgelopen weken.',
    ],
  },
];
