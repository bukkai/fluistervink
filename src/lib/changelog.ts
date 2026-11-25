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

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-11-25',
    topics: {
      Inspreken: [
        'Een onzekere waarneming blijft onzeker als je er met de stem alleen iets bij zegt, zoals "nog één erbij": de soort is daarmee niet bevestigd. Een andere soort noemen of "ja, klopt" maakt hem wel zeker, net als aanpassen met de hand.',
        'Mislukt een uitspraak en probeer je hem later opnieuw, dan gaat "die" of "nog drie erbij" nog steeds over wat je vóór die uitspraak zag, niet over iets van daarna.',
      ],
      Trektelling: [
        '"Ongedaan maken" in een trektelling maakt geen ander stuk van de telling meer ongedaan; zo\'n stuk komt bij "niet begrepen", zodat je het thuis naloopt.',
      ],
    },
  },
  {
    date: '2026-11-24',
    topics: {
      Inspreken: [
        'Nieuw in de soortenlijst: "Uil onbekend", voor een uil waarvan je niet weet welke. Een paar exoten heten nu zoals op waarneming.nl, zoals Hawaiigans en Soendataling.',
      ],
      'Android-app': [
        'Nieuw bij Instellingen, vanaf versie 0.7 van de app: "Opnemen met het scherm uit". Met de volumeknop start en stop je dan een opname, ook met de telefoon in je zak. Een trektelling telt door met het scherm uit. Alleen een telefoongesprek of een andere app die de microfoon pakt (zoals Merlin) pauzeert hem; daarna gaat hij vanzelf verder.',
      ],
    },
  },
  {
    date: '2026-11-23',
    items: [
      'Druk je op Stop terwijl je nog aan het inspreken bent, dan wordt die laatste uitspraak bewaard.',
      'Na een sessie gaan anonieme cijfers naar de server (geen plek, soorten of tekst); uit te zetten bij Instellingen.',
      'De pagina Privacy is overzichtelijker, en zegt wat de server nu bijhoudt: hoe lang, en wat voor toestel (iPhone, Android of computer).',
    ],
  },
  {
    date: '2026-11-22',
    items: [
      'Afschermen en embargo, met de stem of thuis bij de waarneming; de export naar waarneming.nl neemt het mee.',
      '"Onbekend aantal" wordt gezien niet geteld (in eBird een X).',
      'Pas je een onzekere waarneming zelf aan, dan is hij niet meer onzeker; het soortveld zoekt ook op wetenschappelijke naam.',
      'Nieuw bij Instellingen: het scherm aan houden tijdens een sessie.',
    ],
  },
  {
    date: '2026-11-21',
    items: [
      'De trektelmodus is geen proef meer.',
      'Geëxporteerde sessies van meer dan een week geleden staan ingeklapt bij Vorige sessies.',
    ],
  },
  {
    date: '2026-11-20',
    items: [
      'Bij het nalopen zie je welke waarnemingen je onderweg met de stem verbeterde, en hoe ze eerst waren.',
      'De samenvatting zegt hoe lang het nalopen duurde.',
    ],
  },
  {
    date: '2026-11-19',
    items: [
      'Uitspraken die de app niet begreep, staan bij het nalopen bovenaan; met één tik maak je er alsnog een waarneming van.',
      'Correcties met de stem vinden de bedoelde waarneming beter terug, en de gesproken bevestiging zegt wat het was en wat het werd.',
      'eBird herkent bij het importeren meer soorten, dankzij de Engelse naam.',
    ],
  },
  {
    date: '2026-11-18',
    items: [
      'Er gaat minder verloren: een opname blijft bewaard als je gebeld wordt, op een wifi met inlogpagina wachten je uitspraken op echt internet, en een volle telefoon meldt de app.',
      'Trektelling: valt de microfoon weg, dan zet de app hem opnieuw aan; naar een ander scherm vraagt eerst of de telling mag stoppen.',
      'Uitspraken van vóór de eerste GPS-plek krijgen die alsnog, en onder de kaart zet "Plek kiezen voor alle" waarnemingen zonder plek in één keer goed.',
      'Voor eBird telt de afgelegde afstand alleen lopen en fietsen.',
    ],
  },
  {
    date: '2026-11-17',
    items: [
      'Geen bereik? Vogel gewoon door: de app bewaart wat je zegt en verwerkt het zodra er weer verbinding is, ook in een trektelling.',
      'In een trektelling is een vogel zonder gedrag overvliegend.',
      'Een rustig welkom voor wie de app voor het eerst opent, waarin je thuis één zin kunt uitproberen.',
    ],
  },
  {
    date: '2026-11-16',
    items: [
      'Ook zoogdieren, reptielen en amfibieën, dagvlinders en libellen inspreken ("twee reeën"). Alleen vogels? Zet het uit bij Instellingen.',
      'Twijfel tussen soorten ("fitis of tjiftjaf"): de waarneming wordt onzeker en bij het nalopen kies je met één tik.',
      'De volumeknop is voortaan de inspreekknop.',
      'Proef: met oortjes in zegt de app wat hij heeft vastgelegd ("houtduif, 6, overvliegend").',
      'De samenvatting van een sessie staat er altijd bij, en Opslaan blijft in beeld bij het aanpassen van een waarneming.',
      'Voor eBird: een losse waarneming gaat als Incidental, en "Alles klopt" zet een sessie klaar voor beide exports.',
    ],
  },
  {
    date: '2026-11-13',
    items: [
      'Exporteren voor eBird: zet bij Instellingen "Ik gebruik eBird" aan en exporteer je sessies als checklist, met duur en afstand.',
    ],
  },
  {
    date: '2026-11-12',
    items: [
      'Een bereik als "tussen de vijftig en honderd" wordt een schatting, met je eigen woorden als opmerking voor waarneming.nl.',
      'Er speelt nooit meer dan één opname tegelijk; nog eens tikken pauzeert.',
    ],
  },
  {
    date: '2026-11-11',
    items: [
      'Naar Merlin of het scherm op slot pauzeert een trektelling in plaats van te stoppen.',
      'Bij een waarneming staat een kaartje met de plek. Tik erop om de plek te verzetten.',
      'Nieuw bij Instellingen: een zeldzame soort wordt onzeker, en een herinnering om te exporteren.',
      'De volumeknop kan de inspreekknop zijn, en "Begin met vogelen" staat als snelkoppeling op het app-pictogram.',
      'Na een update zie je "Bijgewerkt naar versie …" en deze lijst.',
    ],
  },
  {
    date: '2026-11-09',
    items: [
      'Zeldzame dwaalgasten (zoals de Roodkopklauwier) worden herkend, altijd als onzeker.',
      'Locatie aanpassen: zet de plek op waar je nu staat.',
      'De back-up is kleiner: alleen opnames die nog nodig zijn.',
      'Nieuw icoon en opstartscherm met de vink.',
    ],
  },
  {
    date: '2026-11-08',
    items: [
      'De inspreekknop staat onderaan, in de duimzone.',
      'Ook wetenschappelijke namen inspreken, en de plek van de vogel uit wat je zegt: "buizerd, 500 meter zuid van hier".',
      'Trektelmodus: de microfoon blijft aan, voor wie op één plek telt.',
      'Back-up maken en terugzetten bij Instellingen.',
      '"Wandeling" heet nu "sessie": ook voor de fiets, de vogelhut of de tuin.',
    ],
  },
  {
    date: '2026-11-06',
    items: [
      'Betere spraakherkenning, vooral van soortnamen.',
      'Een waarneming kopiëren, en alleen de spraakopnames wissen.',
      'De export voor waarneming.nl is in het Nederlands.',
    ],
  },
];
