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
        'Ook zeldzame andere dieren worden herkend, zoals een wolf, een knoflookpad of een korenwolf (Europese hamster). Ze worden onzeker, zodat je ze thuis even naloopt.',
        'Een waarneming kreeg soms als plek "null" mee, terwijl je geen plek had genoemd. Dat gebeurt niet meer.',
        'Word je gebeld of gaan je oortjes uit midden in een opname, dan bewaart de app wat er al was. Eerst bleef de knop op "opnemen" hangen en ging de opname verloren.',
        'Zijn er oortjes of een headset verbonden, dan zegt het sessiescherm met welke microfoon de app luistert. Dat is die van de telefoon: praat dus naar de telefoon, ook als die in je zak zit.',
        'Had de GPS nog geen plek (in vliegtuigmodus of binnen kan de eerste meting minuten duren), dan krijgen de uitspraken van daarvoor de eerste plek die binnenkomt alsnog. In een trektelling klopt die precies; lopend zie je bij de waarneming "positie … min later".',
        'Wacht de app op bereik, dan kun je het met het knopje met de twee pijlen meteen opnieuw proberen.',
        'Maakt de spraakherkenning "goudborstje" van "roodborstje", dan wordt het nu gewoon een roodborst.',
        'De Chileense Flamingo staat in de soortenlijst: een exoot die in Nederland geregeld te zien is.',
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
    topics: {
      Inspreken: [
        'Geen bereik? Vogel gewoon door. De app bewaart wat je zegt en verwerkt het vanzelf zodra er weer verbinding is, in de goede volgorde. Je voelt dan lang, kort ("bewaard, wacht op bereik") in plaats van drie korte trillen, en je hoeft thuis niet meer per uitspraak op Opnieuw te tikken.',
        'Verstaat de spraakherkenning "groepje merel" waar je "roepje merel" zei, dan wordt het nu gewoon een roepende merel. Bedoel je echt een groepje, noem dan het aantal ("groepje van twintig vinken").',
        'Zeg je bij een nieuwe waarneming waar de vogel zit ("200 meter ten noorden van hier"), dan komt die plek weer mee. Sinds gisteren viel hij weg.',
      ],
      Trektelling: [
        'In een trektelling is een vogel zonder gedrag nu overvliegend. Zeg je iets anders ("zit", "foeragerend", "roepje"), dan geldt dat.',
        'Een trektelling zonder bereik telt gewoon door; de stukken worden verwerkt zodra er weer verbinding is.',
        'Noemde je in een trektelling een plek, dan raakte de app de soorten daarna in hetzelfde stuk kwijt. Dat is opgelost.',
      ],
      'Over de app': [
        'Wie de app voor het eerst opent, krijgt een rustig welkom in drie stappen: hoe het werkt, toestemming voor microfoon en locatie, en de vraag of je wilt meehelpen. Geen losse meldingen meer boven en onder de startknop.',
        'In het welkom kun je het eerst thuis proberen: zeg één zin en zie meteen wat Fluistervink ervan maakt, met de tril die erbij hoort. Er wordt niets bewaard.',
      ],
    },
  },
  {
    date: '2026-11-16',
    topics: {
      Inspreken: [
        'Behalve vogels kun je nu ook zoogdieren, reptielen en amfibieën, dagvlinders en libellen inspreken ("twee reeën", "een pad", "een atalanta"). Ze krijgen het gedrag en kleed van hun eigen groep en gaan mee naar waarneming.nl. Alleen vogels? Zet het uit bij Instellingen.',
        'In de Android-app kun je tijdens een sessie weer een waarneming typen: het veld bleef niet aangetikt staan.',
        'Twijfel je tussen twee of drie soorten, zeg dat dan gewoon ("fitis of tjiftjaf"). De waarneming wordt onzeker, en bij het nalopen kies je de soort met één tik.',
      ],
      Trektelling: [
        'Pas je tijdens een trektelling een waarneming aan, dan staat de knop Opslaan boven de knop Stop trektelling in plaats van eronder.',
      ],
      'Android-app': [
        'De volumeknop als inspreekknop is geen proef meer en staat voortaan aan. Liever het volume regelen tijdens een sessie? Zet het uit bij Instellingen.',
        'Nieuw, als proef: met oortjes in zegt de app na het trillen wat hij heeft vastgelegd ("houtduif, 6, overvliegend"). Aan te zetten bij Instellingen.',
        'Tijdens een sessie verdwijnt de knop Inspreken ook als je in een geopende waarneming typt, zodat hij niet op het toetsenbord staat.',
      ],
      Nalopen: [
        'De samenvatting van een sessie (soortenlijst met aantallen) staat er nu altijd bij; de instelling ervoor is weg.',
        'Bij het aanpassen van een waarneming blijft de knop Opslaan onderaan in beeld, dus geen eind meer scrollen. Tijdens een sessie is de knop Inspreken dan een klein rondje rechts ernaast.',
        'Bij een afgelopen sessie staat "Waarnemingen" weer helemaal in het tegeltje bovenaan, ook op een smalle telefoon.',
        'Bij het aanpassen van een soort staan de suggesties nu gewoon onder het veld, met de algemene soorten bovenaan. In de Android-app kwam het lijstje soms half over de rest van het scherm te staan.',
      ],
      Export: [
        'Voor wie eBird gebruikt: een losse waarneming (Incidental) gaat niet meer als volledige lijst naar eBird, en hoeft het vinkje "alles genoteerd" niet. Na een export van meer sessies telt dezelfde soort één keer.',
        'Voor wie eBird gebruikt: in een sessie staat het eBird-kaartje nu onderaan, direct onder de export voor waarneming.nl, en "Alles klopt" zet de sessie klaar voor beide.',
      ],
    },
  },
  {
    date: '2026-11-13',
    topics: {
      Export: [
        'Exporteren voor eBird: zet bij Instellingen "Ik gebruik eBird" aan en exporteer je sessies als checklist, met duur en afstand.',
      ],
    },
  },
  {
    date: '2026-11-12',
    topics: {
      Inspreken: [
        'Een bereik als "tussen de vijftig en honderd" wordt een schatting, met je eigen woorden als opmerking voor waarneming.nl.',
      ],
      Nalopen: ['Er speelt nooit meer dan één opname tegelijk; nog eens tikken pauzeert.'],
    },
  },
  {
    date: '2026-11-11',
    topics: {
      Trektelling: [
        'Naar Merlin of het scherm op slot pauzeert de telling in plaats van te stoppen.',
        'De app verwerkt hooguit 5 uur spraak per dag; daarboven stopt een trektelling met uitleg.',
      ],
      Nalopen: [
        'Bij een waarneming staat een kaartje met de plek. Tik erop om de plek te verzetten.',
        'Nieuw bij Instellingen: een zeldzame soort wordt onzeker, en een herinnering om te exporteren.',
      ],
      'Android-app': [
        'De volumeknop kan de inspreekknop zijn.',
        '"Begin met vogelen" als snelkoppeling op het app-pictogram en in de snelle instellingen.',
      ],
      'Over de app': ['Na een update zie je "Bijgewerkt naar versie …" en deze lijst.'],
    },
  },
  {
    date: '2026-11-09',
    topics: {
      Inspreken: [
        'Zeldzame dwaalgasten (zoals de Roodkopklauwier) worden herkend, altijd als onzeker.',
      ],
      Nalopen: ['Locatie aanpassen: zet de plek op waar je nu staat.'],
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
      ],
      Trektelling: ['Trektelmodus: de microfoon blijft aan, voor wie op één plek telt.'],
      Nalopen: ['De plek van een waarneming is met de hand te verzetten op een kaartje.'],
      'Back-up': ['Back-up maken en terugzetten bij Instellingen.'],
      'Over de app': ['"Wandeling" heet nu "sessie": ook voor de fiets, de vogelhut of de tuin.'],
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
