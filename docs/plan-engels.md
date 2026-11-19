# Plan: Fluistervink in het Engels

Voorstel van 19 nov 2026; stap 1 gedaan op 19 nov (#292–#297), stap 2 (#298) en 3 (ontwikkeloptie "English") ook. Punt 8 van "Na v1.0" in `docs/roadmap.md`; komt na de betaalde laag (punt 6), want een tweede taal maakt het publiek veel groter. Het vervolg, vogels van andere landen en namen in andere talen, staat in `docs/plan-andere-landen.md`. Dit plan vervangt het idee "App in het Engels" uit `docs/ideeen.md`.

## Doel

Een Engelstalige vogelaar kan Fluistervink installeren, in het Engels inspreken ("six Wood Pigeons flying over", "no, Brambling instead of Chaffinch") en thuis exporteren naar observation.org of eBird, zonder één Nederlands woord tegen te komen.

## Eén app of twee? Eén app, met een taalkeuze

**Voorstel: één app.** Een tweede app (eigen naam, eigen Play-vermelding) lijkt eenvoudiger, maar kost op elk punt dubbel werk:

- **Live laden:** beide apps laden dezelfde webcode (`server.url`); een tweede app wordt dus toch dezelfde code met een taalvlag, alleen met een tweede set AAB's, verklaringen bij Google, gesloten test met 12 testers en 14 dagen, schermafbeeldingen en beoordelingen.
- **Play kan het al:** een vermelding heeft vertalingen per taal, ook van de **titel**. Engelstaligen zien bijvoorbeeld "Fluistervink: voice bird log", Nederlanders de Nederlandse tekst. Eén app, één teller met beoordelingen en installaties.
- **De gegevens zijn al taalloos:** soort, gedrag, methode, kleed en telmethode zijn waarneming.nl-ID's. Wie van taal wisselt, houdt al zijn sessies; alleen de weergave verandert.
- **Proxy en plafonds:** dezelfde proxy en dezelfde installatietokens. Alleen de taal van de spraakherkenning moet mee (zie Haken en ogen).

Een tweede app is pas zinnig als het merk in het buitenland echt niet werkt. Dat kunnen we eerst goedkoop nagaan met de Engelse titel in Play (zie Merk en naam).

### Taalkeuze

- De taal volgt de telefoon (`navigator.language`): Nederlands bij `nl`, anders Engels. Bij Instellingen te overschrijven.
- **Eén taal voor scherm én inspreken** in de eerste versie. Losse keuzes (Engels scherm, Nederlands inspreken) zijn later goedkoop toe te voegen, maar verdubbelen nu de combinaties om te testen.
- Per uitspraak bewaren in welke taal hij is ingesproken (`Utterance.language`), voor de testset, het log en de export. Bestaande uitspraken zijn `nl`.
- Eerst als ontwikkeloptie "English", alleen bij de eigenaar, zoals elke nieuwe functie.

## Wat er moet gebeuren

### 1. Teksten op het scherm

- Zo'n 8.600 regels Svelte met Nederlandse tekst ertussen, plus meldingen in `.ts`-bestanden (export, eBird-controles, trektelling, deelfuncties). Geen bibliotheek nodig: een woordenboek per taal (`src/lib/i18n/nl.ts` als bron, `en.ts` met hetzelfde type, zodat TypeScript een ontbrekende vertaling meldt) en een functie `t('sleutel', { aantal })`. Meervoud ("1 waarneming", "3 waarnemingen") via `Intl.PluralRules`, datum en tijd via `Intl.DateTimeFormat` met de gekozen taal (`src/lib/format.ts` en de `toLocale…`-aanroepen in ongeveer tien bestanden).
- **Lange pagina's** (`#uitleg`, `#privacy` en de losse `/privacy`, welkom, Probeer het eens) niet in sleutels hakken: per taal een eigen component (`HowItWorks.en.svelte`). Dat leest beter en de vertaling blijft één tekst. Wel de regel: een wijziging aan de Nederlandse pagina gaat in dezelfde PR naar de Engelse (net als nu "houd gelijk met de code").
- **Changelog:** alleen nieuwe regels in beide talen; de oude geschiedenis blijft Nederlands, met een zin erboven.
- **Ontwikkelaarsschermen** (Developer, Statistieken, ontwikkelopties) blijven Nederlands: alleen de eigenaar ziet ze.
- Werkwijze: eerst één PR die de teksten naar sleutels verplaatst zonder iets te vertalen (de app ziet er hetzelfde uit, de tests blijven groen), dan per scherm de vertaling. Zo blijft elke PR klein.

### 2. Inspreken

- **Spraakherkenning:** de proxy zet nu vast `languages[]=nl` (`worker/index.ts`). Wordt: de taal komt mee in het verzoek, de proxy laat alleen `nl` en `en` door (zelfde aanpak als de modellen). De prompt in `src/lib/transcribe.ts` krijgt een Engelse variant: voorbeeldzinnen, de Engelse soortnamen, Engelse bijnamen, en de Engelse leeftijdscodes (1cy, 2cy, juv, ad, imm, 1w, 1s).
- **Model:** een Engelse systeemprompt met eigen promptversie, Engelse voorbeelden en Engelse soortnamen in de lijst (de ID's blijven dezelfde). De Nederlandse prompt blijft ongewijzigd, zodat de Nederlandse testset niets verandert. De tools (`add_observation` enzovoort) zijn al Engels.
- **Engelse soortnamen** (opgehaald in stap 2, zie Stappen): de API van waarneming.nl geeft ze al, met `Accept-Language: en` ("Mute Swan" voor ID 136, nagegaan 19 nov). Gedrag, methode en kleed ook ("present", "calling", "Foraging / Eating"). `scripts/fetch-species.mjs` haalt ze erbij op, in `data/namen-en.json`. (`docs/ideeen.md` zei dat de Engelse namen al in `data/attributen-vogels.json` stonden; dat klopte niet.)
- **Brits en Amerikaans:** observation.org gebruikt Britse namen (Lapwing, Black-throated Diver), eBird de Amerikaanse (Northern Lapwing, Arctic Loon). Een Amerikaan zegt "loon". Oplossing: de namen van eBird als bijnamen erbij, gekoppeld op wetenschappelijke naam (de eBird-taxonomie, `/v2/ref/taxonomy/ebird`, zonder sleutel; sinds stap 2 in `data/ebird-namen.json`). Dan kan de eBird-export meteen ook de eBird-naam invullen. Verder de gangbare korte vormen ("Robin", "Wren", "Blackcap"). Engelse bijnamen en jargon ("BoP", "LBJ", "sprawk", "GBB Gull") in `data/bijnamen-en.json`, net als nu: pas toevoegen als de testset ze laat zien.
- **Code die Nederlands leest**, buiten het model om (nalopen met `grep` op Nederlandse woorden; ongeveer twintig bestanden noemen getallen of richtingen in het Nederlands):
  - `src/lib/spokenPlace.ts`: "500 meter ten zuiden", "honderd meter". In het Engels "500 metres south", maar ook yards en miles.
  - "feedback" aan het begin van een uitspraak (`interpret.ts`): in het Engels hetzelfde woord, dus dat werkt toevallig; de rest van die code nalopen.
  - `findVagrant` en de zeldzame andere dieren zoeken op Nederlandse namen en meervouden ("korenwolven"); Engelse meervouden zijn anders ("geese", "mice").
  - De gesproken bevestiging (`src/lib/spoken.ts`): de stem moet Engels zijn en de zinnen ook.
- **Trillen** is taalloos: dat werkt meteen.

### 3. Exporteren

- **observation.org:** dezelfde database als waarneming.nl (`docs/waarneming-nl.md`). De tekstkolommen (activity, life stage, method, counting method) moeten in de taal van de site; bij een Engelse app een Engelse CSV. Nog nagaan, ingelogd: of het voorbeeldbestand van observation.org dezelfde kolommen heeft en of de import ook ID's aanneemt.
- **eBird:** bestaat al (`src/lib/ebirdExport.ts`), met de eBird-naam in "Common Name" (stap 2); alleen de meldingen nog in het Engels.
- De bestandsnamen en sessienamen ("Sessie", de naam van het gebied) volgen de taal.

### 4. Testset

Het meeste werk. Er is nu geen enkele Engelse opname.

- Drie à vier Engelstalige sprekers, met verschillende accenten (Brits, Amerikaans, een Nederlander die Engels spreekt), elk een paar sessies. Daarmee een eerste Engelse testset van zo'n 150 uitspraken, met de nagelopen waarnemingen als label, net als de Nederlandse.
- `npm run testset` krijgt `--lang en`; de uitslag apart bijhouden.
- Drempel voor "voor iedereen": dezelfde maat als bij de MVP (zo'n 85% zonder correctie goed, correcties met de stem bijna altijd goed).

### 5. Play, privacy en voorwaarden

- Play-vermelding in het Engels: titel, korte en lange beschrijving, schermafbeeldingen (`npm run play-screenshots` met de Engelse app), gegevensveiligheid hoeft niet opnieuw (die is niet per taal).
- **Landen:** nu Nederland en België. Voor Engelstaligen in Nederland hoeft dat niet te veranderen; meer landen hangt af van de soortenlijsten (`docs/plan-andere-landen.md`). Let op: in een land met een andere soortenlijst werkt "zeldzame soort wordt onzeker" verkeerd, dus geen landen openzetten vóór die lijsten er zijn.
- `#privacy` in het Engels, met dezelfde inhoud. De AVG geldt ook voor gebruikers buiten de EU; de verwerkers (OpenAI, Anthropic, Cloudflare, Google) blijven gelijk. Bij de betaalde laag horen voorwaarden; die meteen in beide talen.

## Wie willen we bereiken?

In volgorde, omdat elke stap de vorige nodig heeft:

1. **Engelstaligen die in Nederland en België vogelen:** expats, internationale studenten, buitenlanders op vogelvakantie in Nederland (Texel, Lauwersmeer, de Biesbosch). Zij kunnen meteen: de Nederlandse soortenlijst klopt voor hen, alleen de taal verschilt. Klein publiek, maar een goede proef zonder dat er iets aan de soortenlijsten hoeft.
2. **Gebruikers van observation.org in andere Europese landen** die Engels spreken (Scandinavië, Oost-Europa, Engelstaligen in Spanje en Portugal): hebben de lijsten van hun land nodig (`docs/plan-andere-landen.md`).
3. **eBird-gebruikers:** het Verenigd Koninkrijk, Noord-Amerika. Daar is eBird de standaard en is observation.org klein; de eBird-export hebben we al, maar dan moeten ook de Amerikaanse soortenlijsten erin.

### Hoe bereiken we ze?

- **De Engelse Play-vermelding**, vindbaar op "voice bird log", "birding voice notes", "hands-free bird list". Geen advertenties nodig om te beginnen.
- **observation.org:** het forum en de nieuwsbrief; de app verwijst er zelf naar, dus een bericht dat hij er netjes naar exporteert past daar. Eerst met waarneming.nl overleggen of ze dat goedvinden.
- **Gemeenschappen:** r/birding en r/birdingUK op Reddit, BirdForum, birding-groepen op Discord, Mastodon en Bluesky. Liefst met een korte video: wandelen, inspreken, trillen, thuis de lijst.
- **De Discord van Fluistervink:** een Engelstalig kanaal voor de Engelstalige testers.
- **Testers werven:** zoals bij de lancering, eerst een gesloten groep van 10 à 15 Engelstaligen via de interne test van de beta.

## Haken en ogen

- **Merk en naam.** "Fluistervink" is voor een Engelstalige niet uit te spreken en niet te onthouden. De naam van de app kan blijven (de Engelse titel in Play legt uit wat hij doet), maar hij is ook het geplande **wake word**. Een Engelstalige zegt "Fluistervink" waarschijnlijk anders dan het model geleerd heeft. Opties: het wake word per taal (een Engelse naam, eigen model), of Engelse sprekers in de wake-word-testset. Pas beslissen als het wake word in de app komt (`docs/plan-wakeword.md` op de branch van #290, gesloten 19 nov en later weer op te pakken).
- **Kosten.** Meer gebruikers kost meer per dag. Daarom komt dit plan na de betaalde laag (roadmap punt 6), en gelden de plafonds per installatie gewoon.
- **Ondersteuning.** Feedback komt in het Engels; de eigenaar leest en antwoordt dus in twee talen. `npm run feedback -- notes` moet Engelse feedback kunnen samenvatten (het model kan dat al).
- **Licentie.** De eigenaar wil de enige auteur blijven. Een vertaling is ook tekst van iemand anders: laat Engelstaligen de vertaling **beoordelen** (opmerkingen, "dit klinkt raar"), en schrijf de verbetering zelf. Geen vertaalbestanden van anderen overnemen (`CONTRIBUTING.md` aanvullen).
- **Eenheden.** Afstand bij eBird is in kilometers of mijlen (de export kan beide); in de app kilometers, met mijlen als keuze bij een Engelse telefoon met `en-US`. Afstand in een uitspraak ("200 yards") rekent `spokenPlace.ts` om.
- **Onderhoud.** Elke nieuwe tekst moet daarna in twee talen. De TypeScript-controle op het woordenboek vangt een vergeten sleutel; voor de lange pagina's moet de PR-beschrijving het melden. In `CLAUDE.md` een werkafspraak toevoegen.
- **Prompt in twee talen.** Een verbetering aan de Nederlandse prompt moet ook naar de Engelse, met een eigen testset-run. Verschillen tussen de twee bewust houden en noteren.
- **Gemengd inspreken.** Een Nederlander die "Lapwing" zegt, of een Engelsman die "kievit" heeft geleerd: laat het model beide lijsten zien? Niet in de eerste versie: de prompt wordt langer en de testset kan het nog niet meten.

## Stappen

1. ~~**Teksten naar sleutels**~~ (gedaan 19 nov, in zes PR's, #292–#297; niets vertaald): woordenboek, `t()`, `Intl` voor datum en meervoud. Wat er bewust buiten bleef, staat in `docs/ontwerp.md` (Vormgeving, Teksten).
2. **Engelse soortnamen en attributen ophalen** in `scripts/fetch-species.mjs` (`Accept-Language: en`), en de eBird-namen als bijnamen (ook voor de kolom "Common Name" in de eBird-export). **Gedaan 19 nov** (eerder dan de roadmap, op verzoek van de eigenaar): `data/namen-en.json` (soorten, gedrag, methode, kleed, telmethode; los van de lijst, zoals keuze 1 van `docs/plan-andere-landen.md`), `speciesNameIn('en', id)` en verwanten in `src/lib/vocab.ts`, en `data/ebird-namen.json`, waarmee de eBird-export nu "Common Name" invult. De eBird-namen als bijnamen in de Engelse prompt horen bij stap 3. Details in `docs/waarneming-nl.md`, sectie 2.
3. **Ontwikkeloptie "English":** de schermen vertaald, de proxy laat `en` door, Engelse prompts voor spraakherkenning en model, `Utterance.language`. **Gedaan 19 nov** in twee PR's: de schermen (`en.ts`, namen via de `…Label`-functies in `vocab.ts`) en het inspreken (`promptEn.ts`, Engelse prompt in `transcribe.ts`, taal per uitspraak, proxy, Engelse namen, meervouden en afstanden). Details in `docs/ontwerp.md` (Teksten; Spraak en interpretatie). Bewust nog niet: de Engelse stem van de gesproken bevestiging (native, nieuwe app-versie: `SprekenPlugin.java` moet `taal` lezen, de app stuurt hem al mee), `isBareNo` (alleen Nederlands "nee"), Engelse bijnamen (`data/bijnamen-en.json`, pas met de testset), `npm run testset -- --lang en` (stap 4; de testset geeft de taal van een uitspraak al mee).
4. **Engelse testset** met drie à vier sprekers; prompt bijstellen tot de drempel gehaald is.
5. **Lange pagina's en Play:** `#uitleg`, `#privacy`, welkom, Play-vermelding en schermafbeeldingen in het Engels; export naar observation.org in het Engels (eerst de import nagaan).
6. **Gesloten groep Engelstaligen** in de interne test; daarna de taalkeuze voor iedereen bij Instellingen.

## Open vragen

- Neemt de import van observation.org ID's aan, of alleen tekst in de taal van de site?
- Merk: is "Fluistervink" met een Engelse ondertitel genoeg, of wil de eigenaar een Engelse naam ernaast?
- Wake word voor Engelstaligen (zie Haken en ogen).
- Losse keuze voor de taal van het scherm en die van het inspreken: wie vraagt erom?
