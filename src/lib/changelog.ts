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
    date: '2026-11-24',
    topics: {
      'Android-app': [
        'Nieuw bij Instellingen, vanaf versie 0.7 van de app: "Opnemen met het scherm uit". Met de volumeknop start en stop je dan een opname, ook met de telefoon in je zak. Een trektelling telt door met het scherm uit. Alleen een telefoongesprek of een andere app die de microfoon pakt (zoals Merlin) pauzeert hem; daarna gaat hij vanzelf verder.',
      ],
    },
  },
  {
    date: '2026-11-23',
    topics: {
      Inspreken: [
        'Druk je op Stop terwijl je nog aan het inspreken bent, dan wordt die laatste uitspraak nu gewoon bewaard en verwerkt. Hij ging verloren.',
      ],
      'Over de app': [
        'Hoeveel je liet verwerken (aantal uitspraken en hun duur) bewaart de server nu 13 maanden; daarna alleen nog als totaal per week, zonder te zien van wie. Zie Privacy.',
        'Na een sessie stuurt de app anonieme cijfers: hoe lang hij duurde, hoeveel uitspraken en waarnemingen, hoeveel daarvan niet begrepen of onzeker waren, en of je hebt geëxporteerd. Niet waar, wanneer, welke soorten of wat je zei, en niet van welke telefoon. Uit te zetten bij Instellingen; zie Privacy.',
        'Bij dat verbruik telt de server nu ook wat voor uitspraak het was (knop, trektelling, tuintelling of "Probeer het eens"), in welke taal, en met welke versie van de app. Niet wat je zei. Zie Privacy.',
        'De server onthoudt bij je installatie ook of het een iPhone, een Android-toestel of een computer is. Niet het merk, het model of de versie. Zie Privacy.',
        'De pagina Privacy is overzichtelijker: bovenaan kort wat er met je gegevens gebeurt, de details staan ingeklapt eronder. Er is niets weggelaten.',
      ],
    },
  },
  {
    date: '2026-11-22',
    topics: {
      Export: [
        'Afschermen en embargo: zeg "die afschermen", "die op vijf kilometer vervagen" of "onder embargo tot 1 maart" (ook voor alle vorige tegelijk), of kies het thuis bij de waarneming. In de lijst staat dan een slotje. De export naar waarneming.nl neemt het mee; naar eBird gaat zo\'n waarneming niet. Zeg je "onder embargo" zonder datum, dan staat hij thuis bij het nalopen klaar om de datum te kiezen. Met "zonder embargo" haal je een embargo weer weg.',
        'Zeg je "onbekend aantal" of "niet geteld", dan wordt het aantal "gezien niet geteld" in plaats van een exact aantal van 1. In eBird wordt dat een X.',
      ],
      Nalopen: [
        'Pas je een onzekere waarneming zelf aan (soort, aantal, gedrag of kleed), dan gaat "onzeker" er vanzelf af: je hebt hem dan nagekeken. Wil je hem toch onzeker houden, zet het vinkje dan weer aan.',
        'De suggesties onder het soortveld hebben een eigen kleur en schuiven meteen in beeld, ook boven de knop Opslaan. Zoek je op de wetenschappelijke naam ("corvus"), dan staat die erbij.',
      ],
      Inspreken: [
        'Feedback in een trektelling wordt niet meer uitgevoerd: zeg je "feedback, die buizerd had ter plaatse moeten zijn", dan gaat dat alleen naar de ontwikkelaar en blijft de buizerd zoals hij was. En een soort die lijkt op een eerdere ("graszanger" na grasmussen) wordt een nieuwe waarneming in plaats van een verbetering van de vorige.',
        'Nieuw bij Instellingen: "Scherm aan houden tijdens een sessie". Het scherm gaat dan niet vanzelf uit, zodat je met de volumeknop kunt blijven inspreken.',
        'Spreek je dezelfde soort nog eens in ("een hommel", even later weer "een hommel"), dan wordt dat altijd een nieuwe waarneming. Soms werd de tweede genegeerd omdat hij al in de lijst stond. Met "nog een hommel" telt hij op bij de vorige, zoals altijd.',
        'Vertel je iets van eerder ("gisteren zag ik hier een ijsvogel"), dan bewaart de app het als onzeker, omdat de tijd niet klopt. Huisdieren en vee ("een kat") worden geen waarneming meer.',
      ],
      'Over de app': [
        'Deel je met de ontwikkelaar, dan laat de app lange cijferreeksen (zoals een BSN of telefoonnummer) en e-mailadressen weg, en de opname daarvan ook.',
      ],
    },
  },
  {
    date: '2026-11-21',
    topics: {
      Trektelling: [
        'De trektelmodus is geen proef meer: bij Instellingen staat hij nu gewoon als "Trektelmodus".',
        'Kwamen er twee GPS-metingen vlak na elkaar binnen, dan kon een stuk van de trektelling de minder nauwkeurige plek houden. Nu krijgt het altijd de beste.',
      ],
      Export: [
        'Bij Vorige sessies zijn geëxporteerde sessies van meer dan een week geleden ingeklapt, onderaan. Tik erop om ze te zien.',
      ],
      Nalopen: [
        'In donkere modus is "Met de stem aangepast" en "nagelopen" in de lijst beter te lezen, net als de knop Trektelling starten.',
      ],
    },
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
