# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen. Oudere bevindingen uit de veldtests staan in `docs/veldtests.md`, de beoordeling van de mijlpaal in `docs/mijlpaal-mvp.md`; wat er per PR gebeurde, staat in de PR's op GitHub.

## Waar ik ben (21 okt)

- Bouwstappen 1–7 uit `CLAUDE.md` klaar en gemerged (t/m PR #78). In productie op `fluistervink.stephanmullernl.workers.dev`, met een eerste tester (sinds 16 okt); Tim (alter ego van de eigenaar) is gewist.
- **Mijlpaal MVP gehaald** (12 okt, `docs/mijlpaal-mvp.md`): 88% van de waarnemingen zonder correctie goed, correcties met de stem 9 van de 10 keer.
- **Spraakherkenning: `gpt-4o-transcribe` blijft** (testset 12 okt: 9/12, tegen `gpt-4o-mini-transcribe` 8/12 en `whisper-1` 7/12).
- **Export gebundeld** (PR #90, 13 okt): na het nalopen zet je een wandeling "klaar voor waarneming.nl"; op het scherm Wandelingen gaan alle klaarstaande wandelingen in één CSV. Bestaande wandelingen hebben nog geen "klaar": de nog niet geëxporteerde één keer klaarzetten.
- Uitgaven: bij OpenAI en Anthropic vooraf betaald tegoed met auto-reload uit; dat is de harde grens. Stand 11 okt: $0,36 die maand bij Anthropic, 97% uit de cache, ruwweg een tiende cent per uitspraak.

## Volgende stappen

0. **Native laag** (`docs/plan-capacitor.md`): fase 0 (#94, microfoon van de telefoon zonder echo-onderdrukking; in de auto ook goed, 24 okt) en fase 1 (#95, Android-app met trilpatronen) gemerged op 14 okt. Getest op de Fairphone 5 (Android 15): alle patronen komen door, ook op stil. Eerste wandeling met de app (14 okt, 19 min, 17 uitspraken): ging goed. Microfoon zonder echo-onderdrukking (`mic_opened`), antwoord in 2–7 s. Merlin openen stopt de opname (verwacht, zo laten); vliegtuigmodus midden in een opname: netjes opnieuw geprobeerd. Missers: "ekster" werd "Extra" (STT, ekster ontbreekt), en "één huismus ter plaatse, nee, maak er twee van, een mannetje en een vrouwtje" maakte van de huismus van 11:36 een mannetje en voegde een vrouwtje toe met activiteit roepend (model, Haiku). Nagespeeld met de testset (juiste uitkomst met de hand ingevuld): de huidige prompt deed het 20 van de 21 keer goed, dus een uitschieter. Een extra regel in de prompt maakte geen meetbaar verschil en is niet toegevoegd. Wel de wandeling nalopen, dan komt de uitspraak met het goede antwoord in de testset. Fase 2 (foreground service, PR #96, gemerged 14 okt): **proef geslaagd** (proefwandeling 14 okt 13:43): melding start meteen, 3 van de 7 uitspraken op de achtergrond verwerkt in 6–7 s, tril komt door met het scherm op slot, geen `vibrate_blocked`. Een native wachtrij is dus niet nodig. Scherm op slot tijdens een opname stopt die (zo laten; microfoon in de service niet nu, besloten 14 okt). `#uitleg` en `#privacy` bijgewerkt in PR #99; daarmee is fase 2 klaar. Volgende: fase 3 is een aparte beslissing (opnemen met het scherm uit). Export in de app (15 okt): #98 Opslaan als-venster, maar de CSV was op waarneming.nl uitgegrijsd (uploadveld accepteert alleen het type `text/csv`, Android geeft een .csv buiten Chrome-downloads een ander type); #101/#103 hielpen niet. **Opgelost met #104: de app exporteert xlsx** (in Downloads, zonder venster), upload en import werken (bevestigd 24 okt). Verder 15 okt: versienummer van de app uit git (#100, te zien bij Instellingen, log `native_version`; huidige APK 0.318), terugknop gaat een pagina terug en op het hoofdscherm naar de achtergrond (#102), kaart met knop "Kaart opnieuw laden" na een zwart vlak (#102). 16–21 okt: zes dagen weg met de app (0.318), 6 wandelingen, 115 uitspraken, geen problemen met de app zelf. Feedback opgehaald 21 okt: drie punten, alle drie in een PR (#106 net verstuurde feedback leek overschreven, want hij klapte meteen in; #107 lange wandelnaam overlapte het label; #108 een verbeterde notitie werd aangevuld in plaats van vervangen, door een regel in de prompt). Testset (eigenaar, 258 uitspraken): opgeslagen antwoorden 87% goed, opnieuw met de huidige prompt 86%, met #108 84% (verschillen zijn ruis). De wandeling van 21 okt staat klaar maar is nog niet nagelopen. **Nieuwe tester**: 4 korte wandelingen (16–17 okt), 4 uitspraken, alles goed herkend. Daarna (21 okt): #109 losse feedback per apparaat (de Android-app en de PWA in Chrome overschreven elkaars losse feedback op de proxy; zo ging de wens hieronder verloren; het punt van 16 okt kwam op 21 okt terug van de PWA; op de proxy staat nu per apparaat een `losse-feedback-<id>` naast de oude `losse-feedback`) en #110 gebruik per tester op Developer (wandelingen, uitspraken, feedback, laatste actie; alleen wat gedeeld is). Developer liep vast bij dubbele feedback (`each_key_duplicate`, knop "Verwerkte tonen" deed niets); nu ontdubbeld in proxy en app. Twee oude testcodes afgesloten, gegevens van `stephan` en `Tim` gewist (Tims ene wandeling van 11 okt is daarmee ook uit de testset). Alle feedback tot 21 okt is verwerkt. **Fase 4 (Google Play, 24 okt):** PR #105 (workflow die bij een tag `v0.*` een ondertekende AAB bouwt; handleiding `docs/google-play.md`) is klaar om te mergen. Play Console-account (persoonlijk) aangemaakt, wacht op verificatie door Google. Daarna: app aanmaken, upload-key en de vier secrets, tag `v0.1`, AAB uploaden naar de interne test, testers toevoegen; eigen debug-APK eerst verwijderen.
1. Een paar echte betatesters uitnodigen (de eigenaar regelt ze) en nog een wandeling van jezelf met de huidige versie; daarna Capacitor (trillen en achtergrond eerst, wake word later). Zie de roadmap naar v1.0 hieronder.
2. Bij elke nieuwe gedeelde wandeling `npm run feedback -- pull` en `npm run testset` draaien, eventueel ook met `--model claude-sonnet-5-5`.
3. Prompt verbeteren met wat de testset laat zien ("tortelduif"), telkens nagaan met de testset.
   - **Waar correcties vandaan komen** (analyse 24 okt, 15 nagelopen wandelingen, 229 waarnemingen van het model): 81% nooit aangeraakt; de meeste stemcorrecties zijn aanvullingen ("nog drie erbij"). Echte fouten: ~10 soorten verkeerd verstaan door de spraakherkenning (vaak korte uitspraken met één soort, verward met een andere echte vogelnaam: kraai/gaai, smient/vink, kuifmees/koolmees), 1–2 keer het model, 4 keer een detail (geslacht, leeftijd). Het model is dus niet het knelpunt.
   - **STT-prompt blijft zoals hij is** (proef 24 okt, 153 opnames, elke variant drie keer): korte lijst, eigen soorten vooraan (eerlijk getest: lijst uit de wandelingen tot 16 okt, gemeten vanaf 17 okt), andere voorbeeldzinnen en lijst achteraan zitten allemaal binnen de ruis (dezelfde prompt schommelt ±3 soorten per run; eigen lijst +1 op 114). Zonder soortenlijst duidelijk slechter (88,6% tegen 94%). De hardnekkige fouten zitten in de opname zelf, deels mogelijk een afgekapt begin (microfoon gaat pas aan na het drukken); eigenaar vindt het goed zo.
4. Kosten per wandeling: staan op Developer zodra PR #133 gemerged is (zie Kostenoverzicht onder Ideeën voor later); niet meer apart in het testset-script.

## Testers en feedback (6 nov)

Feedback opgehaald op 6 nov: 8 testers en installaties met gedeelde wandelingen (Aafje, Jurian, Maarten, 5 installaties zonder code). Kosten sinds 27 okt: $1,14, ongeveer een halve cent per uitspraak. Geen nieuwe feedback in de app; wel een lijstje van **Jurian** per bericht (wandeling 4 nov, 70 uitspraken, hardlopend):

- Verstaanfouten, alle in de spraakherkenning (het model deed het goed met wat het kreeg): meerkoet → "meeuw" (2×), koperwiek → "Boerenzwaluw", "4 wilde eenden en een winterkoning" → "Hier wilde een winterkoning" (eenden kwijt, terecht onzeker). "Eén werd twee" niet teruggevonden in de data; mogelijk "Twee meeuw." (opname terugluisteren).
- Import mislukte ("seen" niet herkend): de site moest op Engels. **PR #149: export in het Nederlands** (namen tegen `/api/v1/lookups/` en de attributen-API gecontroleerd). Import met de site op NL **werkt** (6 nov), alleen de Winterkoning niet: waarneming.nl heeft hem net hernoemd naar *Nannus troglodytes*. **PR #153**: soortenlijst opnieuw opgehaald (ook de gorzen hernoemd, Bonte Kraai nu ondersoort *Corvus corone cornix*, oud ID 67 wijst naar 255102) en een workflow die elke maandag de lijst ophaalt en bij wijzigingen een PR opent. Na het mergen: in GitHub Actions toestaan PR's te maken (zie PR), en bij de volgende import een Bonte Kraai meenemen.
- Toegezegd aan Jurian: opnames wissen (#151) en waarneming kopiëren (#152) zijn gemerged. **Locatie met de hand wijzigen: PR #155** (6 nov): "Locatie aanpassen" in het bewerkformulier opent een kaartje (tikken of slepen), vast 10 m, GPS-plek bewaard in `recordedPosition` met "Terug naar de opgenomen plek"; `CLAUDE.md` bijgewerkt. Slepen nog op de telefoon proberen; daarna Jurian laten weten.
- **Vóór Terschelling (8 nov):** PR #158 (kale "nee, <vogel>" voert de correctie uit, maar onzeker, met wat het eerst was in de reden) en PR #159 (Inspreken-knop vast onderaan in de duimzone, weg tijdens het typen). Release naar stable gedaan (8 nov, `e635e11`, met #158 en #159). **Kwaliteitsronde 8 nov** (logboek in `docs/kwaliteitsronde.md`): PR #161 (Inspreken-knop terug na versturen of toetsenbord dicht) en #162 (windrichting, verouderde plek-twijfel, "Terug naar de opgenomen plek", opnames tellen, migratie, "per ongeluk" na wissen, "-1 min", `#uitleg`). Op de telefoon nog proberen: toetsenbord dicht met de terugknop (knop moet terugkomen). Op Terschelling testen: #155 slepen, #156 plek met de stem, #157 Latijnse namen, gpt-transcribe in de wind, de knop onderaan (per ongeluk opnemen bij het scrollen?), en hoe vaak de grens van 3 minuten knelt bij trek.
- **Plek met de stem: PR #156** (8 nov, gevraagd door meerdere testers): "500 m zuid van hier" verschuift de plek (nauwkeurigheid groeit mee), "aan de overkant van de rivier" wordt onzeker om thuis op de kaart te zetten; de app leest de kaart niet. Nog niet met het echte model getest: na een wandeling waarin het gebruikt wordt de testset draaien.
- **Wetenschappelijke namen inspreken: PR #157** (8 nov, gevraagd door testers): de soortenlijst voor het model heeft nu ook de Latijnse naam ("Fringilla coelebs" → Vink); kost bijna niets dankzij de cache. De prompt van de spraakherkenning is niet aangepast. Nog testen: een paar opnames met Latijnse namen inspreken en door de testset halen; worden ze slecht verstaan, dan alleen de gewone soorten aan de STT-prompt toevoegen en vergelijken.
- Nadenken, niet gepland: geluidsherkenning (BirdNET; Merlin kan het niet), wake word met de telefoon in de zak.
- **Testset opnieuw** (6 nov, na de reparatie in #150): Jurians 70 opnames 3× door `gpt-4o-transcribe` en het huidige model: 84/83/83% helemaal goed (opgeslagen antwoorden 91%). Ter vergelijking 1× `gpt-4o-mini-transcribe` 74% en `whisper-1` 71%. Opnames in de wind zijn erg wisselend: korte uitspraken krijgen per run een andere vogel. Per fout:
  - meerkoet → "meeuw": **komt terug**. "Twee meeuwen en zeven waterhoen" 3 van de 3 keer weer meeuwen (`whisper-1` hoort wel "2 meerkoeten"); "Twee meeuw." 1 van de 3 keer, 2× "twee meerkoet".
  - koperwiek → "Boerenzwaluw": **komt terug in een andere vorm**: 3 van de 3 keer "Roepje vink." (een voorbeeld uit onze STT-prompt; het model vult zelf in als het niets verstaat). `whisper-1` en mini horen "Ropewiek"/"Poppewiek", dus het woord zit er wel in.
  - "4 wilde eenden en een winterkoning" → "Hier wilde een winterkoning": **komt terug**: het getal "vier" wordt 3 van de 3 keer "hier"; 2 keer komt de eend wel terug ("Hier wilde eend en een winterkoning"), zonder aantal. Het label is nog fout (alleen de winterkoning, Jurian heeft het niet aangepast).
  - "Eén werd twee": **niet gevonden**. "Twee meeuw." hoort elk model als "twee" (ook mini en `whisper-1`), dus als hij "één" zei is dat niet te horen. Wel iets anders: "Wilde Eend." (later "dat waren er vier, niet één") was "vier wilde eenden": mini hoort dat, `gpt-4o-transcribe` liet "vier" weg en hoort nu "Fuut", "Vijverduiker". Opnames om te luisteren: `testset/luisteren/jurian-twee-meeuw.webm` en `jurian-wilde-eend.webm`.
  - Nieuw opgevallen: "Meerkoet." (09:53) wordt nu "Merel"/"Migo"; "Piepgeluiden." wordt "twee/drie grauwe ganzen". Mogelijk ook "Roepje vink": bij een onverstaanbare opname zet `gpt-4o-transcribe` iets uit de prompt neer.
  - **Label 18/19 verbeterd**: 2× krakeend + 1× waterhoen (`whisper-1` hoort trouwens "Eén waterhoed", bevestigt "een" i.p.v. "nee"). Labels worden afgeleid uit de gedeelde wandeling, dus de opgehaalde sessie is aangepast met `testset/label-jurian-krakeend.mjs`; opnieuw draaien als een pull Jurians wandeling ooit opnieuw binnenhaalt.

- **Maarten** (8 nov): wil langer achter elkaar inspreken bij het trektellen (nu na 3 minuten gestopt). Voorstel `docs/plan-trektelmodus.md` (nog niet goedgekeurd): stukken knippen bij een pauze, stilte niet versturen, beveiligingen en een plafond per dag. Maarten antwoordde dezelfde dag: telefoon naast zich op een vaste post, scherm aan geen probleem, telt nu met de Live Atlas-app van Sovon, export naar trektellen.nl een goede extra optie, test graag mee (staat in het plan). Nieuwe wens: op de fiets inspreken via de microfoon van zijn oortjes, scherm uit; dat vraagt fase 3 van `docs/plan-capacitor.md` (opnemen met het scherm uit, starten met de knop op de oortjes).

## Lancering in Play (8 nov)

Roadmap in `docs/lancering.md`: eerst 14 dagen een gesloten test met minstens 12 testers (regel van Google voor nieuwe persoonlijke accounts), dan productietoegang aanvragen; openbaar rond begin december. Logo is bij een artiest aangevraagd; mag tijdens de gesloten test als nieuwe app-versie.

**Stand 9 nov:** privacypagina live op `fluistervink.nl/privacy` (#170, release naar stable gedaan), winkelvermelding en gegevensveiligheid ingevuld (`docs/play-store/`), eerste release in de gesloten test ingediend ter beoordeling. Daarna: deelnamelink in `PLAY_TEST_LINKS.stable`, testers werven (15–20).

## Kwaliteitsronde (11 nov)

Na de release naar stable van 11 nov (`82c1b73`). Logboek in `docs/kwaliteitsronde.md`, alles in **PR #202**: de proxy leest een kapot gedeeld bestand niet meer (liet Developer vastlopen), Stop tijdens het weer aangaan van de microfoon stopt de trektelling nu echt, lege eerste meting zette het achtergrondniveau van de trektelling vast, "Trektelling starten" 48 px, `#privacy` zonder "geen statistieken" (bronnen nagekeken op 11 nov), trilpatronen van de trektelling in `#uitleg`.

Besloten (11 nov): `android:allowBackup="true"` blijft zo en komt niet in `#privacy` (het is de back-up van de gebruiker zelf; uitleg in het logboek). De gegevensveiligheid in Play is naast de nieuwe privacytekst gelegd: het formulier hoeft niet aangepast (`docs/play-store/README.md`, in #202). Op de telefoon proberen na het mergen: trektelling, naar Merlin en terug, meteen op Stop.

## Android-roadmap en ontwikkelopties (11 nov)

Roadmap in `docs/roadmap-android.md` (goedgekeurd 11 nov): vogelen zonder naar de telefoon te kijken, in vijf stappen. Besloten: volumeknop **tikken**; gesproken bevestiging **alleen met oortjes**; stap 3 (opnemen met het scherm uit) **na de productierelease**; wake word **open source** (openWakeWord). Nieuwe functies komen eerst achter een **ontwikkeloptie** (kaartje Ontwikkelopties bij Instellingen, alleen met de code van de eigenaar, `src/lib/devOptions.ts`); uitzondering is de volumeknop. **Geen aparte ontwikkel-app**, dus stap 3 en 5 (nieuwe toestemming microfoon in de service, verklaring bij Google) wachten echt tot na de productierelease.

Gebouwd en gemerged op 11 nov:

- #185 **Volumeknop als inspreekknop** (voor iedereen, Instellingen → Volumeknop, standaard uit). Tik = start, nog een tik = stop; alleen met de app op het scherm. Bluetooth-sluiterknopjes (selfie) sturen dezelfde toets: eentje proberen. Native (`KnopPlugin.java`).
- #186 Snelkoppeling "Begin met vogelen" op het app-pictogram (ontwikkeloptie, native `SnelkoppelingPlugin.java`).
- #187 Gesproken bevestiging in de oortjes ("Houtduif, 6, overvliegend"; ontwikkeloptie, native `SprekenPlugin.java`, tekst in `src/lib/spoken.ts`).
- #189 Trektelling pauzeert bij Merlin (of scherm op slot) in plaats van te stoppen, verder als je binnen 15 minuten terugkomt (ontwikkeloptie; geen native code: de `AudioRecordingCallback` heeft pas zin bij stap 3).
- #191 Zeldzame soort (zeldzaamheid 3–4, 71 soorten) en een letterlijke voorbeeldzin uit de STT-prompt ("Roepje vink.") worden onzeker (twee ontwikkelopties).
- #192 "Wat zei ik?": kaartje "Laatst verstaan" op het sessiescherm met transcript en afspeelknop (ontwikkeloptie).
- #193 Herinnering aan de export op het hoofdscherm na een week (ontwikkeloptie).
- #194 Samenvatting van een sessie: soortenlijst met aantallen, nieuw dit jaar, kopiëren (ontwikkeloptie). "Eerste van het seizoen" bewust weggelaten.
- #198 Voor iedereen (11 nov): zeldzame soort onzeker, samenvatting en exportherinnering bij Instellingen → "Nalopen en export" (standaard aan, `src/lib/preferences.ts`); trektelpauze en snelkoppeling zonder keuze. Getypte losse feedback gaat meteen weg. Ontwikkelopties nog: stem, voorbeeldzin, "Wat zei ik?".
- #199 Tegel "Begin met vogelen" in de snelle instellingen (native `BeginTegel.java`), toevoegen via Instellingen → "Snel beginnen".
- #200 Update zichtbaar (geen native code): onderin "Nieuwe versie laden…" terwijl de service worker installeert (niet bij de eerste installatie, niet tijdens een sessie), na het herladen tien seconden "Bijgewerkt naar versie <commit>" (laatste versie in localStorage). Changelog op `#nieuw` ("Wat is er nieuw?", link bij Instellingen onder de versie), met de hand in `src/lib/changelog.ts`; afspraak in `CLAUDE.md`: elke PR met iets zichtbaars zet er een regel bij. Het laadbalkje is nog niet echt gezien (de browser van Claude draait geen service workers): bij de volgende deploy de app afsluiten en openen.
- #201 (open) "Laatst verstaan" na de feedback van 11 nov (18:10, 18:16; die stonden al als verwerkt, maar er was nog niets mee gedaan): tijdens het afspelen regelt de volumeknop het volume (vlag `playback.playing`, `src/lib/playback.svelte.ts`); het kaartje is één regel in de vaste balk boven de inspreekknop, tik op de tekst voor het hele transcript. Geen native code. Volumeknop nog op de telefoon proberen.

- #203 (open) Gesproken bevestiging na de feedback van 11 nov (20:05): zegt de gezegde plek erbij ("30 meter zuid") en "onzeker" bij de waarneming die het is, niet aan het eind. Feedback van 20:10 (kaartje "Laatst verstaan" bovenaan, maar ingeklapt) kwam van versie `82c1b73`, nog vóór #201; #201 maakt het al één regel, alleen onderaan. Eerst #201 op de telefoon proberen, dan beslissen of de regel naar boven moet.

Nog te doen:

- **Tag v0.3 gezet (11 nov)** met #185–#187, #198 en #199: beide AAB's uploaden in de Play Console (beta naar de interne test, stabiel naar de gesloten test). Debug-APK `apk/fluistervink-0.582-beta.apk`. Nog niets op de telefoon geprobeerd: volumeknop, snelkoppeling en tegel (koude start, vanaf de achtergrond, vergrendelscherm, één sessie), stem met en zonder oortjes en met een podcast, Merlin tijdens een trektelling, afspelen in "Wat zei ik?", kopiëren van de samenvatting.
- De overgebleven ontwikkelopties een paar wandelingen meenemen en per optie beslissen. Bij #191 tellen hoe vaak een zeldzame soort echt was (nu voor iedereen aan).
- Volgende stappen uit de roadmap: stap 3 en 5 na de productierelease.

## Roadmap naar v1.0 (13 okt)

Werkdefinitie van v1.0: een vogelaar die je niet persoonlijk begeleidt, kan de app installeren, een hele wandeling gebruiken zonder naar het scherm te kijken, en thuis zonder gedoe naar waarneming.nl exporteren.

**Besloten (13 okt): v1.0 voorlopig voor een besloten kring**, met toegangscodes zoals nu. Openbaar in de Play Store zou betekenen: bepalen wie de API-kosten betaalt (tegoed per gebruiker, eigen sleutel, limiet) en misbruik afvangen; dat komt pas later aan de orde. Uitgewerkt in `docs/plan-laagdrempelig.md` (28 okt, goedgekeurd): de eigenaar betaalt, plafond en daglimiet in de consoles van OpenAI en Anthropic, ook de PWA zonder code. **Gebouwd in PR #142** (aanmelden zonder code met Play Integrity/Turnstile, code optioneel); na het mergen nog instellen (geheimen, Turnstile-widget, Play Integrity, nieuwe app-versie), zie het plan onder Instellen. **v0.1-release mislukte (28 okt)**: Dependabot zette Gradle op 9.8.2 (#115), dat werkt niet met AGP 8.13; PR #141 zet hem terug op 8.14.3, daarna opnieuw taggen.

1. **Veldgebruik afmaken met de native laag (Capacitor), de kern van v1.0:**
   - Trillen op de achtergrond en met het scherm uit (grootste ergernis van de eerste wandeling).
   - Opnemen met het scherm uit via een foreground service; microfoon loslaten als Merlin hem wil.
   - Verspreiden via de Play Store (eerst interne test).
   - Te overwegen: volumeknop of Bluetooth-afstandsbediening als push-to-talk (handschoenen, telefoon in de zak).
   - Wake word **buiten v1.0**: de knop bevalt, en een wake word brengt eigen valse meldingen mee.
2. **Herkenning breder bewijzen:** de 88% rust op drie wandelingen van één spreker, in één omgeving, in oktober.
   - Meer sprekers: twee à drie echte betatesters met een echte wandeling. Tim is een alter ego van de eigenaar, dus alle gegevens tot nu toe komen van één spreker.
   - Open punten: korte spookopnames (#92); nocmig: niet nu. "Pijl" en "vaaltje" werken al (bijnamen, proef 11 okt).
   - Kosten per wandeling: op Developer (PR #133).
3. **Klaar voor vreemden:**
   - Twee omgevingen (stabiel en beta, zie Ideeën voor later).
   - Welkom en uitleg voor wie geen uitnodiging kreeg: toestemming voor microfoon en GPS, eerste wandeling stap voor stap. **Vast voor v1.0** (besloten 8 nov).
   - **Back-up** (besloten 8 nov: als volgende bouwen): een kaart "Back-up" bij Instellingen die alles (met opnames) als bestand bewaart en terugzet, met de datum van de laatste back-up. Bij vreemden is "telefoon kwijt of app verwijderd, niet-geëxporteerde sessies weg" de eerste pijnlijke klacht.
4. **Thuis meer waarde dan alleen exporteren** (zolang de API van waarneming.nl wacht):
   - Kaart clusteren (voorstel onder Ideeën voor later).
   - Snellere review: alleen de onzekere langslopen, "alles klopt" met één tik.
5. **Bewust niet in v1.0:** API van waarneming.nl (v1.0 levert juist de gebruikers op die de aanvraag sterker maken), GPS-track, accounts, BirdNET, wake word. Overweging 8 nov: later **optioneel** een account, alleen als iemand daar zelf voor kiest bij Instellingen (bv. voor automatische back-up of een nieuwe telefoon); standaard blijft gratis en anoniem.

Volgorde: (a) nu de kleine open punten, betatesters uitnodigen en een wandeling; (b) Capacitor: trillen, foreground service, eventueel volumeknop; (c) twee omgevingen, dan twee à drie testers erbij; (d) ~~voorjaar~~ **besloten 6 nov: geen voorjaarsronde afwachten.** In het najaar is genoeg te testen; eerst een weekend Terschelling met de app, daarna v1.0 uitbrengen. Aanmelden zonder code (#142) is ingesteld en werkt (5 installaties).

## Twee omgevingen (24 okt)

PR #112: beta blijft op workers.dev (branch `main`), stabiel op `fluistervink.nl` (branch `stable`, `npm run release`). KV en geheimen gedeeld, veld `channel` in gedeelde wandelingen. Eén Play-app: beta-AAB naar de interne test, stabiele naar een gesloten test. Gemerged 24 okt. **Live op 24 okt:** `fluistervink.nl` bij Cloudflare (Free; parkeerrecords van TransIP weg, geen mail: SPF `-all`, DMARC `p=reject`), branch `stable` aangemaakt, Workers Builds-project `fluistervink-stable` (build `npm run build:stable`, branch `stable`), vier geheimen gezet. `/api/ping` met de eigenaarscode geeft 200. Proefopname op de telefoon via `https://fluistervink.nl/#code=…` geslaagd. "Always Use HTTPS" staat aan; `www.fluistervink.nl` stuurt door naar `fluistervink.nl` (AAAA `100::` proxied plus redirect-regel, 301). Debug-APK `apk/fluistervink-0.348-beta.apk`.

## Kwaliteitsronde (24 okt)

PR #113: `docs/kwaliteitsronde.md` (direct na een release naar stable een ronde op de beta, met logboek), `npm run release` toont de laatste ronde en vraagt eerst, Dependabot (`.github/dependabot.yml`; meldingen en beveiligingsupdates in de repo aangezet), `npm audit --omit=dev` in de check. Eerste ronde gedaan op 24 okt (logboek in `docs/kwaliteitsronde.md`): PR's #121 (snelheidslimiet proxy, Content-Type), #122 (validatie aantallen), #123 (contrast, `#privacy`). Dependabot opende meteen #118 (@types/node), #119 (TypeScript 7, faalt) en #120 (happy-dom, het hoge lek). Open voorstel: Inspreken-knop lager, in de duimzone (andere indeling, eerst overleggen).

Tweede ronde op 28 okt, direct na de release (stable bijgewerkt, tag v0.2), vanaf `1f14481`: PR's #143 (snelheidslimiet op het delen), #144 (dependencies, Capacitor 8.6; debug-APK `apk/fluistervink-0.439-beta.apk`), #145 (bevindingen code-review: unieke installatienamen, audiomigratie), #146 (`#privacy` en `#uitleg`). Wat bleef liggen staat in het logboek. Opvolger van `gpt-4o-transcribe`: PR #154.

## Open punten

- **App hing op het laadscherm na een deploy** (14 okt): de service worker had een oude `index.html` naast nieuwe JavaScript in zijn cache (deploy tijdens het openen). Op de telefoon hersteld via de WebView-devtools (adb, `webview_devtools_remote_<pid>`); PR #97 herstelt het voortaan zelf (`public/herstel.js`, log `cache_recovered`). Workers Builds heeft nu build watch paths: `*.md` en `docs/*` deployen niet meer.

- **Nieuwe versie tijdens een wandeling** (#65, afgehandeld 24 okt): de app zoekt alleen bij het opstarten naar een nieuwe versie en herlaadt niet meer midden in het gebruik. Na een volledige herstart tijdens een wandeling krijgt hij wel de nieuwe versie (Android activeert de wachtende service worker als de app dicht was); onschuldig, zo gelaten.
- **Korte spookopnames** (PR #92, 13 okt): grens van `isAccidental` naar 3,5 s en < 0,3 woord/s, zodat ook de Bosuil (3,9 s) onzeker wordt. Bewust klein gehouden; geen verdere moeite nodig volgens de eigenaar.
- **STT gaf één keer zelf antwoord** in plaats van te transcriberen ("Sorry, ik kan niet voldoen aan het verzoek …", 11 okt) en liet daarbij het woord "feedback" weg. Onschuldig, maar in de gaten houden.
- Cloudflare-previews: vermoedelijk onthoudt Cloudflare het deploy-commando per branch vanaf de eerste build. Bij problemen: nieuwe branch maken.
- Een branch-regel op `main` met verplichte check kan niet: GitHub biedt dat niet voor privérepo's zonder Pro. De check draait wel bij elke PR.
- **`gpt-4o-transcribe` verdwijnt 26 feb 2027.** Opvolger `gpt-transcribe` getest (6 nov, 401 opnames, vier sprekers): 84,5% tegen 82,0%, sneller, goedkoper; `keywords` hielpen niet. **PR #154** stapt over. Nog open: "ekster" → "extra", meerkoet → "merel" (zit in de opname).

## Ideeën voor later

Nog niet gepland; eerst overleggen.

- **Back-up automatisch** (na de kaart "Back-up", zie de roadmap): via de proxy (dan met een optioneel account) of naar Drive via het deelmenu (native plugin).
- **Inzenden via de API van waarneming.nl** — op de lange baan (13 okt): toegang is niet vanzelfsprekend; pas aanvragen als blijkt dat er interesse in de app is (meer gebruikers = sterkere aanvraag). Tot die tijd de gebundelde CSV-export. (Uitgezocht 13 okt; de officiële documentatie op `waarneming.nl/api/docs/*.md` gaf ons een 403, dus gecontroleerd in de TypeScript-client [observation-js](https://github.com/robbeverhelst/observation-js); nog na te lopen in de documentatie, ingelogd):
  - De API kan wel waarnemingen invoeren (niet via het importformulier). `POST /api/v1/observations/create/` ("one-way sync") neemt een lijst waarnemingen en geeft per waarneming de URL of de fouten; een fout houdt de rest niet tegen; `external_id` voorkomt dubbel invoeren (bestaande wordt bijgewerkt). `create-single/` is voor één waarneming met foto's/geluid.
  - Velden passen op wat we bewaren: `species` (ID), `date`, `time`, `point` (GeoJSON of WKT), `accuracy`, `number`, `sex`, `activity`, `life_stage`, `method`, `counting_method`, `is_certain`, `notes`, `uuid`.
  - OAuth: `/api/v1/oauth2/authorize/` en `/api/v1/oauth2/token/` (authorization code of password grant, met client-ID en secret). Testomgeving: `waarneming-test.nl`.
  - Eerst een client-ID aanvragen via het contactformulier (concept in de sessie van 13 okt: app, nalopen vóór inzenden, vaste soortenlijst, 88% goed; vragen: inlogmethode, client secret, testaccount op waarneming-test.nl, `create/` met `external_id` en welke scope, redirect-URL). Daarna: account koppelen bij Instellingen, route `/api/waarneming` in de proxy (CORS, secret), knop "Inzenden" voor de klaarstaande wandelingen, ID/link van waarneming.nl bewaren, `#privacy` en `#uitleg` bijwerken.
- **Soortenstatistieken over alle gebruikers:** tellen per soort-ID wat het model koos, wat met de hand gecorrigeerd werd en wat het niet kon plaatsen, om de soortenlijst, bijnamen en STT-prompt bij te stellen. Kan in de proxy (Analytics Engine of D1); alleen geaggregeerd, en op `#privacy` vermelden. Pas relevant bij meer gebruikers; tot die tijd geeft de testset hetzelfde beeld.
- Foto koppelen aan een waarneming via tijd en locatie.

**Voorstellen van Claude** (8 nov, op verzoek van de eigenaar). **Alle zes gebouwd op 11 nov** als ontwikkeloptie (zie Android-roadmap en ontwikkelopties hierboven); de fysieke knop ook (#185). Voorgestelde volgorde: eerst Terschelling en wat daaruit komt, dan 1 en 2, dan welkom voor vreemden en back-up (zie de roadmap), dan een fysieke knop als push-to-talk (volumeknop of de knop op de oortjes; kleiner dan fase 3 en lost het grootste deel van Maartens fietswens op), fase 3 pas daarna, export naar trektellen.nl na de proef met Maarten.

1. **Geen verzonnen soort uit de STT-prompt.** Bij een onverstaanbare opname zet `gpt-transcribe` soms een voorbeeld uit de prompt neer ("Roepje vink."): geloofwaardig en verzonnen. Een transcript dat letterlijk een voorbeeldzin is onzeker maken, of de voorbeeldzinnen zonder echte soort schrijven. Meten met de testset.
2. **Onwaarschijnlijke soort wordt onzeker.** De meeste fouten zijn verwisselingen met een andere echte vogelnaam (kuifmees/koolmees, kraai/gaai, smient/vink). Kiest de app een zeldzame soort (zeldzaamheid van waarneming.nl staat er al), dan onzeker, zodat hij bovenaan staat bij het nalopen. Later eventueel ook seizoen en plek.
3. **Gesproken bevestiging in de oortjes** (optioneel). De tril zegt alleen *dat* iets is opgeslagen, niet *wat*. Een korte stem ("drie houtduiven, overvliegend") maakt corrigeren in het veld mogelijk ("nee, holenduiven"). Tekst-naar-spraak van Android, geen extra API. Eerst een kort plan in `docs/`.
4. **Samenvatting na een sessie:** soortenlijst met aantallen, "nieuw dit jaar", "eerste van het seizoen". Thuis meer waarde dan alleen exporteren.
5. **Herinnering aan de export:** staan sessies een week klaar zonder export, dan een melding op het hoofdscherm.
6. **"Wat zei ik?" in het veld:** tik op de laatste waarneming speelt de opname af en toont het transcript, zodat je ziet waarom iets misging ("hier" i.p.v. "vier") en meteen kunt corrigeren.

(Eigen soorten vooraan in de STT-prompt was ook een idee, maar is al getest op 24 okt: binnen de ruis.)

## Android-app

- Bouwen vraagt Java 21 (Temurin uit `~/Library/Java/JavaVirtualMachines/`; Homebrew bouwt het op de Intel-Mac uit de broncode) en `JAVA_HOME` naar de Java van Android Studio, zie README.
- Installeren gaat draadloos (adb, draadloze foutopsporing): de USB-poort ziet de Fairphone niet. De verbinding valt weg als de telefoon op slot gaat of van wifi wisselt; dan opnieuw aanzetten. De poort vindt `adb mdns services`; koppelen (`adb pair`) blijft bewaard.
- Trillen als "communicatieverzoek": als "melding" hield Android het op stil tegen (`ignored_for_ringer_mode`). Nagaan met `adb shell dumpsys vibrator_manager`.
- De app heeft een eigen database (los van de PWA in Chrome): eenmalig overzetten met de JSON-export en -import.
- Icoon en opstartscherm (9 nov, PR #176): `npm run app-icons` maakt ze uit `public/icon.svg`; daarvoor stond het standaardicoon van Capacitor erin. Pas te zien na een nieuwe tag; debug-APK `apk/fluistervink-0.533-beta.apk`. In dezelfde PR Gradle terug naar 8.14.3: Dependabot (#147) had 9.8.2 gezet, waarmee niets meer bouwde (ook de release-workflow niet); grote Gradle-versies slaat Dependabot nu over.
- In een nieuwe worktree eerst `npm run build` en `npx cap sync android`, en `ANDROID_HOME=~/Library/Android/sdk` (er is geen `local.properties`).

## API-sleutels

- Anthropic: `fluistervink` (6 nov 2026, opvolger van `spreeuw-api-key`), in de Fluistervink-workspace. **Verloopt 9 dec 2027.** Vervangen: in de Console (Settings → API keys) een nieuwe aanmaken in die workspace (anders ontbreekt de rekening op Developer), dan `npx wrangler secret put ANTHROPIC_API_KEY` en `… --env stable`, en lokaal `.dev.vars`. Proefopname op beta en stable, daarna de oude intrekken.
- `ANTHROPIC_ADMIN_KEY` (rekening op Developer) is een aparte sleutel, met een eigen verloopdatum.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen staan niet in git: `.dev.vars` per computer zelf aanmaken (zie README), en `.testers.json` meekopiëren als je testers met het script wilt beheren.
