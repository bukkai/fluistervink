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
      Inspreken: [
        'Wacht de app op bereik, dan kun je het met het knopje met de twee pijlen meteen opnieuw proberen.',
      ],
      Nalopen: [
        'Bij het nalopen van de onzekere: pas je er een aan en sla je hem op, dan telt hij als nagelopen. Eerst werd hij overgeslagen.',
        'Locatie aanpassen: de knop heet nu "Huidige locatie", met een vizier ervoor.',
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
        'Gebruik je eBird? Zet bij Instellingen "Ik gebruik eBird" aan. Na het stoppen vraagt de app of je alles hebt genoteerd, en bij een sessie staat een kaartje waarmee je hem als checklist voor eBird exporteert, met duur en afstand.',
        'Voor wie eBird gebruikt: bij Sessies staat een knop "Exporteren voor eBird" voor alle nagelopen sessies in één bestand. Is de vraag "alles genoteerd?" bij een sessie nog open, dan beantwoord je hem daar met één tik, of je kiest "Niet naar eBird". In de lijst zie je per sessie wat al naar waarneming.nl en naar eBird is.',
      ],
    },
  },
  {
    date: '2026-11-12',
    topics: {
      Trektelling: [
        'Geen "niet begrepen"-tril meer als je op Stop drukt en het laatste stuk leeg is. Onder de stopknop staat niet meer "eerste stuk na 1 minuut".',
      ],
      Inspreken: [
        'Een bereik als "tussen de vijftig en honderd" of "enkele honderden" wordt een schatting (75, of 300), met je eigen woorden als opmerking voor waarneming.nl.',
        'De inspreekknop staat iets hoger, zodat je de gloed tijdens het opnemen helemaal ziet.',
      ],
      Nalopen: [
        'Een opname terugluisteren bij het nalopen of aanpassen: nog eens tikken pauzeert, en er speelt nooit meer dan één opname tegelijk.',
        'De samenvatting van een sessie noemt niet meer welke soorten nieuw zijn dit jaar: de app is er niet om soorten te verzamelen, dat doet waarneming.nl.',
      ],
    },
  },
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
