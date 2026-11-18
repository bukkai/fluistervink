# Plan: offline wachtrij

Voorstel van 17 nov 2026, gebouwd op 17 nov in vier PR's (#251, #254, #255, #256). **Afgerond:** in het veld getest op 17 nov (vliegtuigmodus, corrigeren, trektelling), op stable sinds 18 nov. Punt 1 van "Na v1.0" in `docs/roadmap.md`. Tot nu toe stond dit bij "Bewust níet in de MVP" in `CLAUDE.md`; de eigenaar wil het nu als eerste.

## Waarom

In een natuurgebied, op een dijk of in een vogelhut is het bereik vaak slecht of weg. Nu gaat een uitspraak dan mis: de spraakherkenning faalt, de uitspraak krijgt status `failed`, de telefoon trilt drie keer kort ("fout bij verwerken"), en de gebruiker moet thuis zelf op "Opnieuw" tikken, per uitspraak. De opname is niet kwijt (local-first), maar het voelt wel zo. Voor nieuwe gebruikers bepaalt dit of ze de app vertrouwen.

Het doel: **zonder bereik gewoon doorvogelen.** De app bewaart alles en verwerkt het vanzelf zodra er weer verbinding is, in de goede volgorde, zonder dat de gebruiker iets hoeft te doen.

## Wat er al is

- Elke uitspraak staat eerst in IndexedDB (`pending`), daarna verwerkt de wachtrij ze één voor één op `recordedAt` (`src/lib/queue.ts`). Een uitspraak die bleef hangen, gaat bij de start opnieuw.
- Tijd en GPS komen van de telefoon zelf; de GPS werkt zonder internet.
- Het gebied van waarneming.nl (`/api/area`) wordt al alsnog opgezocht als het eerst niet lukte (`src/lib/area.ts`).
- De app zelf staat in de cache van de service worker (vite-plugin-pwa, `globPatterns`), dus de PWA opent ook zonder netwerk.
- `api.ts` geeft bij een netwerkfout een `ApiError` met status 0 ("Geen internetverbinding" of "Proxy niet bereikbaar").

## Wat er verandert

### 1. Netwerkfout = wachten, niet mislukken

In `processUtterance` onderscheiden we de fouten:

| Fout | Nu | Straks |
| --- | --- | --- |
| Geen verbinding (status 0, `navigator.onLine` false) of een time-out | `failed` | blijft `pending`, met `waitingSince`; de wachtrij **stopt** |
| Proxy of aanbieder tijdelijk weg (502, 503, 504, 529) | `failed` | idem, met een paar pogingen (zie 2) |
| Plafond bereikt (429 `audio_limit`), toegang geweigerd (401, 403), ongeldig verzoek (400) | `failed` | blijft `failed`: wachten helpt niet |

De wachtrij stopt bij de eerste uitspraak die moet wachten, en verwerkt de latere dus niet eerder. Dat is belangrijk: "nee, keep" of "nog drie erbij" verwijzen naar de waarneming ervoor, en die moet er dan al zijn. De volgorde blijft zo altijd die van het inspreken.

### 2. Vanzelf weer verder

De wachtrij probeert het opnieuw:

- bij het `online`-event;
- als de app weer op het scherm komt (`visibilitychange`);
- bij een nieuwe uitspraak (zoals nu);
- en op een timer: na 15 s, 30 s, 1 min, daarna elke 2 minuten zolang er iets wacht (`navigator.onLine` liegt soms: wifi zonder internet, één streepje 4G).

Een poging die weer een netwerkfout geeft, kost niets (geen verzoek bij de aanbieder) en telt niet als `attempt_failed` in de log; wel één `queue_waiting` bij het begin en één `queue_resumed` met hoe lang het duurde en hoeveel er wachtten.

### 3. Laten zien en voelen

- **Tril bij het opslaan:** zonder bereik weet de gebruiker nu pas na de time-out dat het mis is, en dan krijgt hij drie korte trillen ("fout"). Straks: bij een netwerkfout een eigen patroon, "bewaard, wacht op bereik" (open vraag 1). Bij de volgende uitspraken zolang er gewacht wordt, alleen dat patroon, direct bij het opslaan (er komt toch geen antwoord).
- **Na het verwerken:** de trillen die normaal per uitspraak komen, blijven achterwege als hij langer dan een minuut heeft gewacht: twintig trillen achter elkaar als je weer bereik hebt, helpen niemand. Eén korte tril als alles binnen is, met de gesproken bevestiging "zes uitspraken verwerkt" (als die aan staat).
- **Op het sessiescherm** een rustige regel boven de lijst: "Geen bereik: 3 uitspraken wachten. Ze worden verwerkt zodra er verbinding is." Geen foutkleur; het is geen fout. In de lijst staan de wachtende uitspraken met hun tijd (zoals nu bij `pending`).
- **Bij Stop:** wachten er nog uitspraken, dan stopt de sessie gewoon; de samenvatting en de naam van het gebied komen als ze verwerkt zijn. Nalopen en klaarzetten gaan pas als alles verwerkt is (zoals nu bij `unprocessed` in `src/lib/sessions.ts`).

### 4. De app opent zonder netwerk

- **PWA:** werkt al (service worker). Nagaan met een proef in vliegtuigmodus.
- **Android-app:** laadt de webcode live van de site (`server.url`). De WebView gebruikt de service worker van die site, dus de app zou ook offline moeten openen, maar dat is nooit geprobeerd. Proef: app openen in vliegtuigmodus, na een eerdere start met netwerk. Lukt het niet, dan overleggen (de meegeleverde webcode als terugval gebruiken is native werk en een nieuwe app-versie).
- **Aanmelden:** het installatietoken (`src/lib/install.ts`) wordt alleen bij de eerste start opgehaald; een verlopen token vernieuwen moet ook kunnen wachten tot er bereik is, zonder dat uitspraken mislukken.

### 5. Trektelling

Een trektelling zonder bereik blijft gewoon opnemen: de stukken stapelen zich op en gaan daarna in één keer door de spraakherkenning. Wel een grens, zodat de telefoon niet volloopt: na 2 uur wachten (ongeveer 120 stukken van een minuut) een melding op het scherm en twee lange trillen. De telling stopt niet vanzelf. Het plafond per dag in de proxy telt pas bij het verwerken, dus een uur offline tellen kost geen tegoed dat je niet gebruikt.

## Niet in dit plan

- **Spraakherkenning op de telefoon** (Whisper lokaal): zou offline ook verwerken, maar is veel groter en slechter in soortnamen.
- **Een sync-status per waarneming** naar een server: er is geen server met gegevens.
- **Achtergrond-sync** (Background Sync API of een native taak) zodat de wachtrij ook verwerkt terwijl de app dicht is: pas als blijkt dat het nodig is. Tijdens een sessie draait de app toch (foreground service); daarbuiten verwerkt hij bij het openen.

## Volgorde en PR's

1. **Wachten in plaats van mislukken** (punt 1 en 2), met tests (bij de wachtrijtests in `src/lib/observations.test.ts`, of een eigen `queue.test.ts`) (nagebootste `fetch` die eerst offline is en daarna weer online). Achter een ontwikkeloptie `offlineWachtrij` (werkwijze tijdens de proef, `docs/omgevingen.md`).
2. **Laten zien en voelen** (punt 3): regel op het sessiescherm, trilpatroon. `#uitleg` en de trilpatronen daar bijwerken.
3. **Proeven** (punt 4 en 5): vliegtuigmodus in de PWA en de app, een wandeling met het netwerk uit, een korte trektelling offline. Daarna de ontwikkeloptie weg en voor iedereen aan, met een regel in de changelog en `CLAUDE.md` bijgewerkt (de zin onder "Local-first" en de MVP-lijst).

Zo gebouwd: #251 (punt 1 en 2), #254 (punt 3), #255 (trektelling na 2 uur, een token dat niet meer werkt vernieuwen) en een laatste PR die het voor iedereen aanzet, met daarbij: gebieden en de naam van de sessie alsnog na het inhalen, en klaarzetten of exporteren pas als alles verwerkt is.

Alles is webcode: geen nieuwe app-versie nodig, tenzij de proef in punt 4 laat zien dat de app offline niet opent.

## Open vragen

Alle drie gebouwd volgens het voorstel; bij te stellen na de proeven.

1. **Trilpatroon voor "bewaard, wacht op bereik"** (`src/lib/feedback.ts`): lang, kort (450, 150, 120), het spiegelbeeld van onzeker (kort, lang). Eén lange is al "trektelling gepauzeerd", drie korte blijft voor een echte fout.
2. **Na hoeveel wachten geen tril meer per uitspraak?** Een minuut (`CATCH_UP_AFTER_MS` in `src/lib/queue.ts`).
3. **Grens voor een trektelling offline:** na 2 uur een melding en twee lange trillen, de telling loopt door (`LONG_WAIT_MS`).
