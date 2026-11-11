// Wat er nieuw is, voor gebruikers: pagina #nieuw (src/lib/Changelog.svelte),
// gelinkt bij Instellingen en vanuit de melding na een update. Elke PR die
// iets zichtbaars verandert, zet hier een regel bij, in gewone taal: bovenaan
// onder de datum van de merge, bij het onderwerp waar hij bij hoort.
// Alleen wat voor iedereen geldt (geen ontwikkelopties of schermen van de
// eigenaar). De stabiele versie toont vanzelf alleen wat al in stable zit.

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
  topics: Partial<Record<Topic, string[]>>;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-11-11',
    topics: {
      Inspreken: ['De eerste opname na de vraag om de microfoon is niet meer leeg.'],
      Trektelling: [
        'De app verwerkt hooguit 5 uur spraak per dag. Kom je daarboven, dan stopt een lopende trektelling met uitleg op het scherm. Wat je daarna inspreekt, blijft bewaard: tik de volgende dag op "Opnieuw".',
        'Naar Merlin of het scherm op slot pauzeert de telling in plaats van te stoppen.',
        'De knop "Trektelling starten" staat nu bovenaan naast de locatie, zodat de lijst met waarnemingen meer ruimte heeft. Ook de uitleg onder de inspreekknop is weg.',
        'Op Stop drukken terwijl de microfoon net weer aanging (terug van Merlin) stopt de telling nu echt. Aanhoudende wind telt niet meer als spraak als de microfoon stil begon.',
        'De stopknop springt niet meer op en neer.',
      ],
      Nalopen: [
        'Bij een waarneming staat een kaartje met de plek. Tik erop om de plek te verzetten.',
        'Na een sessie: de naam wijzig je met het potloodje, en de linkjes onderaan zijn knoppen geworden die je makkelijker raakt.',
        'Nieuw bij Instellingen, onder "Nalopen en export": een zeldzame soort wordt onzeker, een samenvatting van elke sessie, en een herinnering om te exporteren. Alle drie staan aan.',
      ],
      'Android-app': [
        'De volumeknop kan de inspreekknop zijn (bij Instellingen).',
        '"Begin met vogelen" als snelkoppeling op het app-pictogram, en als tegel in de snelle instellingen.',
      ],
      'Over de app': [
        'Na een update zie je onderin even "Bijgewerkt naar versie …", en deze lijst met wat er nieuw is.',
        '"Hoe werkt het?" is korter.',
        'Privacy: duidelijker dat de ontwikkelaar ziet hoeveel de app gebruikt wordt (alleen aantallen).',
      ],
    },
  },
  {
    date: '2026-11-09',
    topics: {
      Inspreken: [
        'Zeldzame dwaalgasten (zoals de Roodkopklauwier) worden herkend, altijd als onzeker.',
      ],
      Trektelling: [
        'Feedback midden in een trektelling blijft een losse opmerking; de waarnemingen eromheen blijven staan.',
      ],
      Nalopen: ['Locatie aanpassen: de knop "Mijn plek nu" zet de plek op waar je nu staat.'],
      'Back-up': ['De back-up is kleiner: alleen opnames die nog nodig zijn.'],
      'Android-app': ['Nieuw icoon en opstartscherm met de vink.'],
    },
  },
  {
    date: '2026-11-08',
    topics: {
      Inspreken: [
        'De inspreekknop staat onderaan, in de duimzone.',
        'Ook wetenschappelijke namen inspreken ("Fringilla coelebs").',
        'De plek van de vogel uit wat je zegt: "buizerd, 500 meter zuid van hier".',
        'Een kale "nee, waterhoen" maakt de verbetering onzeker: het kan ook "een waterhoen" zijn geweest.',
      ],
      Trektelling: ['Trektelmodus: de microfoon blijft aan, voor wie op één plek telt.'],
      Nalopen: ['De plek van een waarneming is met de hand te verzetten op een kaartje.'],
      'Back-up': ['Back-up maken en terugzetten bij Instellingen.'],
      'Over de app': [
        'Welkom voor wie de app voor het eerst opent, met de eerste sessie in vier stappen.',
        '"Wandeling" heet nu "sessie": ook voor de fiets, de vogelhut of de tuin.',
      ],
    },
  },
  {
    date: '2026-11-06',
    topics: {
      Inspreken: ['Betere spraakherkenning, vooral van soortnamen.'],
      Nalopen: [
        'Een waarneming kopiëren in de review.',
        'Alleen de spraakopnames wissen, en de waarnemingen houden.',
      ],
      Export: ['De export voor waarneming.nl is in het Nederlands.'],
    },
  },
];
