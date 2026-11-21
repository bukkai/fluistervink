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
    date: '2026-11-20',
    topics: {
      Nalopen: [
        'Verbeterde je een waarneming onderweg met de stem ("nee, wulpen"), dan staat er in de lijst "Met de stem aangepast", met hoe hij eerst was. Zo zie je bij het nalopen of de correctie op de goede waarneming terechtkwam.',
        'Heb je een sessie nagelopen, dan zegt de samenvatting hoe lang dat duurde, bijvoorbeeld "42 waarnemingen, nagelopen in 3 minuten". Alleen de tijd dat je met de sessie bezig was telt.',
      ],
      Trektelling: [
        'Elk stuk van een trektelling krijgt de beste GPS-plek van die telling, want je staat stil. Komt er later een nauwkeurigere meting, dan krijgen de stukken die alsnog.',
      ],
    },
  },
  {
    date: '2026-11-19',
    topics: {
      Nalopen: [
        "Begreep de app een uitspraak niet, dan zie je die bij het nalopen boven de waarnemingen, met wat er verstaan is en de opname. Zat er toch een vogel in, maak er dan met één tik een waarneming van en kies de soort. Na Opslaan geldt hij als nagelopen, niet als onzeker. Eerst stond zo'n uitspraak alleen weggestopt bij Uitspraken.",
      ],
      Inspreken: [
        'Met de gesproken bevestiging aan hoor je bij een correctie nu wat het was en wat het werd: "holenduif wordt wulp, 3" of "houtduif, 3 wordt 6". Zo hoor je meteen of de correctie op de goede waarneming terechtkwam.',
        'Een correctie met de stem, zoals "die kraanvogel van twintig minuten geleden was een blauwe reiger", vindt de bedoelde waarneming beter terug: de app kijkt verder terug, en weet bij een onzekere waarneming wat je toen zei.',
      ],
      Export: [
        'Het bestand voor eBird heeft nu ook de Engelse naam van elke soort, zoals eBird hem schrijft. Daardoor herkent eBird bij het importeren meer soorten meteen, ook de soorten waarvan de wetenschappelijke naam bij eBird anders is (zoals de Winterkoning).',
      ],
      'Over de app': [
        'Instellingen heeft een logischere volgorde: eerst wat de app verstaat, dan de bediening in het veld, tellen, nalopen en export, en onderaan je gegevens. Je naam staat nu bij Delen met de ontwikkelaar.',
      ],
    },
  },
  {
    date: '2026-11-18',
    topics: {
      'Android-app': [
        'De uitleg om van Fluistervink Beta over te stappen naar de gewone app heeft een stap erbij: eerst de beta-test verlaten. Anders gaf Google Play na opnieuw installeren toch weer de beta.',
      ],
      Export: [
        'Voor eBird telt de afgelegde afstand alleen nog lopen en fietsen. Een stuk met de auto of de boot (sneller dan 30 km/u) telt niet meer mee.',
      ],
      'Back-up': [
        'Zet je een back-up terug, dan komt ook het logboek van die sessies mee. Deel je sessies met de ontwikkelaar, dan ging dat logboek eerst verloren.',
      ],
      Trektelling: [
        'Tik je tijdens een trektelling op Instellingen of een ander scherm, dan vraagt de app eerst of de telling mag stoppen. Hij stopte daar zonder iets te zeggen.',
        'Ging de microfoon bij "Trektelling starten" de eerste keer niet aan (vooral vlak na het geven van toestemming), dan probeert de app het nu meteen nog een keer, net als de knop Inspreken al deed.',
        'Valt de microfoon weg tijdens een trektelling (bijvoorbeeld als je oortjes uitgaan), dan pauzeert de telling even en zet de app de microfoon opnieuw aan. Eerst telde hij stil door zonder iets te horen. Lukt dat niet, dan zegt het scherm waarom de telling gestopt is.',
      ],
      Inspreken: [
        'Een waarneming kreeg soms als plek "null" mee, terwijl je geen plek had genoemd. Dat gebeurt niet meer.',
        'Word je gebeld of gaan je oortjes uit midden in een opname, dan bewaart de app wat er al was. Eerst bleef de knop op "opnemen" hangen en ging de opname verloren.',
        'Zijn er oortjes of een headset verbonden, dan zegt het sessiescherm met welke microfoon de app luistert. Dat is die van de telefoon: praat dus naar de telefoon, ook als die in je zak zit.',
        'Had de GPS nog geen plek (in vliegtuigmodus of binnen kan de eerste meting minuten duren), dan krijgen de uitspraken van daarvoor de eerste plek die binnenkomt alsnog. In een trektelling klopt die precies; lopend zie je bij de waarneming "positie … min later".',
        'Wacht de app op bereik, dan kun je het met het knopje met de twee pijlen meteen opnieuw proberen.',
        'Maakt de spraakherkenning "goudborstje" van "roodborstje", dan wordt het nu gewoon een roodborst.',
        'De Chileense Flamingo staat in de soortenlijst: een exoot die in Nederland geregeld te zien is.',
        'Met "Ook andere dieren inspreken" aan herkent de app nu ook zeldzame andere dieren, zoals een wolf of een knoflookpad, net als dwaalgasten altijd als onzeker. "Korenwolf" wordt de Europese hamster.',
        'Op een wifi waar je eerst moet inloggen (trein, camping) wachten je uitspraken nu tot er echt internet is. Eerst gingen ze verloren.',
        'Vindt de GPS na een halve minuut nog geen plek, dan staat er "Nog geen locatie, inspreken kan gewoon" in plaats van een eindeloos "Locatie zoeken…".',
        '"Ongedaan maken" terwijl er niets ongedaan te maken is, geeft nu twee trillen (niet begrepen) in plaats van één (opgeslagen).',
        '"Nog vijf eraf" bij drie vogels maakt er één van, maar onzeker, zodat je hem bij het nalopen ziet.',
        'Is de telefoon vol, dan zegt de app dat de opname niet bewaard kon worden (en stopt een trektelling), in plaats van de opname stil kwijt te raken.',
      ],
      Nalopen: [
        'Bij het nalopen van de onzekere: pas je er een aan en sla je hem op, dan telt hij als nagelopen. Eerst werd hij overgeslagen.',
        'Is een waarneming met de stem verwijderd terwijl je hem aan het bewerken was, dan zegt Opslaan dat nu, in plaats van stil niets te doen.',
        'Verbeter je met de stem terwijl het bewerkformulier openstaat, dan zet Opslaan die verbetering niet meer terug: alleen wat je in het formulier zelf aanpaste, wordt opgeslagen.',
        'Locatie aanpassen: de knop heet nu "Huidige locatie", met een vizier ervoor. Vindt hij je plek niet, dan geeft hij het na 10 seconden op (was 20) en zegt hij erbij als het aan het bereik ligt. Laadt de kaart niet, dan staat dat eronder.',
        'Waarnemingen zonder plek (bijvoorbeeld een trektelling waarbij de GPS geen plek vond)? Onder de kaart zet "Plek kiezen voor alle" ze in één keer op de plek waar je stond.',
      ],
    },
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
