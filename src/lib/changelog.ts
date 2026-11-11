// Wat er nieuw is, voor gebruikers: pagina #nieuw (src/lib/Changelog.svelte),
// gelinkt bij Instellingen en vanuit de melding na een update. Elke PR die
// iets zichtbaars verandert, zet hier een regel bij, bovenaan, in gewone taal.
// Alleen wat voor iedereen geldt (geen ontwikkelopties of schermen van de
// eigenaar). De stabiele versie toont vanzelf alleen wat al in stable zit.

export interface ChangelogEntry {
  /** Datum van de merge, JJJJ-MM-DD */
  date: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-11-11',
    items: [
      'Na een update zie je onderin even "Bijgewerkt naar versie …", en deze lijst met wat er nieuw is.',
      'De eerste opname na de vraag om de microfoon is niet meer leeg.',
      'Bij een waarneming staat een kaartje met de plek. Tik erop om de plek te verzetten.',
      'Android-app: de volumeknop kan de inspreekknop zijn (bij Instellingen).',
      'Trektelling: de stopknop springt niet meer op en neer.',
    ],
  },
  {
    date: '2026-11-09',
    items: [
      'Zeldzame dwaalgasten (zoals de Roodkopklauwier) worden herkend, altijd als onzeker.',
      'Locatie aanpassen: de knop "Mijn plek nu" zet de plek op waar je nu staat.',
      'Feedback midden in een trektelling blijft een losse opmerking; de waarnemingen eromheen blijven staan.',
      'Android-app: nieuw icoon en opstartscherm met de vink.',
      'De back-up is kleiner: alleen opnames die nog nodig zijn.',
    ],
  },
  {
    date: '2026-11-08',
    items: [
      'Welkom voor wie de app voor het eerst opent, met de eerste sessie in vier stappen.',
      'Back-up maken en terugzetten bij Instellingen.',
      'Trektelmodus: de microfoon blijft aan, voor wie op één plek telt.',
      '"Wandeling" heet nu "sessie": ook voor de fiets, de vogelhut of de tuin.',
      'De inspreekknop staat onderaan, in de duimzone.',
      'Ook wetenschappelijke namen inspreken ("Fringilla coelebs").',
      'De plek van de vogel uit wat je zegt: "buizerd, 500 meter zuid van hier".',
      'De plek van een waarneming is met de hand te verzetten op een kaartje.',
      'Een kale "nee, waterhoen" maakt de verbetering onzeker: het kan ook "een waterhoen" zijn geweest.',
    ],
  },
  {
    date: '2026-11-06',
    items: [
      'Betere spraakherkenning, vooral van soortnamen.',
      'Een waarneming kopiëren in de review.',
      'Alleen de spraakopnames wissen, en de waarnemingen houden.',
      'De export voor waarneming.nl is in het Nederlands.',
    ],
  },
];
