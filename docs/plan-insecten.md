# Plan: insecten inspreken

Voorstel van 22 nov 2026, dezelfde dag goedgekeurd; laag 1 dezelfde dag gebouwd als ontwikkeloptie `insecten` (zie Gebouwd). Aanleiding: een tester zei "een goudhaantje, maar de kever, niet de vogel" (20 nov, app-b726a027), en het model maakte er de vogel Goudhaan van. De eigenaar: een kever mag als kever, als dat er zo bij gezegd wordt; en opvallende kevers en wantsen (meikever, lieveheersbeestje), hommels en bijen worden best eens ingesproken. Maar er zijn heel veel insecten. Dit plan is de verstandige weg daarheen. Vervolg op `docs/plan-soortgroepen.md` (zoogdieren, reptielen en amfibieën, dagvlinders en libellen).

## Wat we weten (22 nov)

**Hoe vaak het voorkomt:** in alle gedeelde uitspraken (1417, `testset/feedback/`) gaat er één over een insect: het goudhaantje hierboven. Het is wel november, dus dat zegt weinig. Eerst meten in het voorjaar, dan de lijst kiezen.

**De groepen bij waarneming.nl** (openbare API, `/api/v1/region-lists/50<groep>/species/`, met `Accept-Language: nl`). "Inheems, algemeen tot zeldzaam" is hetzelfde filter als voor de vogels in de prompt (`scripts/fetch-species.mjs`):

| Groep | ID | Soorten | Inheems, algemeen tot zeldzaam | Verzamelsoort(en) |
| --- | --- | --- | --- | --- |
| Kevers | 16 | 4668 | 2591 | Kever onbekend (27916, *Coleoptera indet.*) |
| Wantsen, cicaden en plantenluizen | 15 | 1929 | 1210 | Wants onbekend (18649, *Heteroptera indet.*) |
| Bijen, wespen en mieren | 17 | 6394 | 4074 | Hommel onbekend (105323, *Bombus spec.*), Bij onbekend (186200, *Anthophila indet.*), Vliesvleugelige onbekend (186749) |
| Nachtvlinders | 8 | 2518 | 1234 | Vlinder/rups onbekend (1225617, *Lepidoptera indet.*) |
| Sprinkhanen en krekels | 14 | 76 | 26 | Sprinkhaan onbekend (105325, *Orthoptera indet.*) |
| Vliegen en muggen | 18 | 6037 | 3866 | Zweefvlieg onbekend (18628), Tweevleugelige (Vlieg) onbekend (10058) |
| Insecten (overig) | 6 | 1250 | 676 | – |

Samen ruim 13.000 soorten. Dat past nooit in de prompt (nu ±350 vogels plus ±250 andere dieren), en ook niet in de prompt van de spraakherkenning.

Ook gevonden: de soorten zelf hebben vaak een naam die het onderscheidt ("Goudhaantje (kever) onbekend", *Chrysolina spec.*, 22578; "Gewone meikever" 1463, "Vliegend hert" 1660, "Zevenstippelig lieveheersbeestje" 8944, "Aziatisch lieveheersbeestje" 8953). De volgorde in de regiolijsten (`rank`, `sort_order_rank`) is systematisch, niet hoe vaak een soort gemeld wordt; die aantallen moeten ergens anders vandaan.

**Gedrag, methode en kleed** hebben per groep eigen ID's, net als bij de andere dieren. Het voorbeeldbestand van de bulkimport heeft opzoektabellen voor alle groepen (bijvoorbeeld 57 regels voor kevers), en `/api/v1/species-groups/<groep>/attributes/` geeft ze per groep.

## Aanpak in drie lagen

### Laag 1: een vangnet per groep (nu)

Doel: wie een insect noemt, verliest het niet en krijgt geen verkeerde vogel.

- **In de prompt alleen de verzamelsoorten** per groep (de laatste kolom hierboven): een stuk of tien regels. "Een wants" wordt Wants onbekend, "een hommel" Hommel onbekend.
- **Opzoeken zoals bij dwaalgasten.** Noemt de spreker een insect dat niet in de prompt staat, dan geeft het model de gezegde naam door (`unlisted_species`, zoals nu) en ook de groep als die gezegd is ("de kever"). De app zoekt eerst in de volledige lijst van die groep (`findVagrant`, nu met een groep erbij): "goudhaantje" + kever wordt Goudhaantje (kever) onbekend. Vindt hij niets, dan wordt het de verzamelsoort van de groep, met de gezegde naam in de twijfelreden. **Altijd onzeker**: de spraakherkenning kent die namen niet, dus thuis nalopen.
- **Zonder groepswoord blijft een vogelnaam een vogel**: "een goudhaantje" is de Goudhaan. De regel in de prompt (NL en EN): alleen als de spreker zegt dat het om een insect gaat ("de kever", "het insect", "niet de vogel") de insectenlijst.
- **Het soortveld bij het nalopen** zoekt ook in de volledige insectenlijsten, anders kun je "Kever onbekend" thuis niet goedzetten. Die lijsten zijn groot (±13.000 namen, ruw ruim 1 MB, gecomprimeerd een paar honderd kB), dus een **apart bestand dat pas geladen wordt als het nodig is** (dynamische `import()`), zodat de app niet trager start. De service worker cachet het, dus het werkt ook offline nadat het één keer geladen is. Voor de opzoekstap in het veld hetzelfde: het bestand laden bij het starten van een sessie met de keuze aan, niet bij het opstarten van de app.
- **Onder de keuze "Ook andere dieren inspreken"**, eerst als ontwikkeloptie `insecten` tot het bevalt.
- **Gegevens:** `scripts/fetch-species.mjs` haalt de groepen erbij, met attributen per groep (`data/attributen-<groep>.json`). De volledige lijsten komen in een eigen bestand per taal (bijvoorbeeld `data/soorten-insecten.json`), zodat `soorten-nl-alle.json` niet groeit. De wekelijkse PR (`soortenlijst.yml`) houdt ze bij.
- **Export:** waarneming.nl werkt zoals bij de andere dieren (wetenschappelijke naam, gedrag en methode op tekst van de groep). eBird neemt alleen vogels: insecten gaan daar niet heen, zoals de andere dieren nu.
- **Uitleg:** één voorbeeld erbij ("een meikever", "een hommel"), NL en EN. Changelog.

### Laag 2: opvallende soorten in de prompt (voorjaar)

Doel: de soorten die mensen echt noemen, worden zeker herkend en niet onzeker.

- **Zo'n 50 tot 80 soorten** in de prompt, met hun naam ook in de prompt van de spraakherkenning (daar meet de testset of het de vogelnamen niet slechter maakt). Denk aan: gewone meikever, junikever, vliegend hert, zevenstippelig en Aziatisch lieveheersbeestje, roodpootschildwants, groene stinkwants, vuurwants, aardhommel, akkerhommel, steenhommel, honingbij, hoornaar, Aziatische hoornaar, gewone wesp, kolibrievlinder, sint-jansvlinder, eikenprocessierups, grote groene sabelsprinkhaan.
- **Kiezen op gegevens, niet op gevoel:** (1) wat er in laag 1 echt is ingesproken (het log en de gedeelde sessies van april–juni), en (2) hoe vaak een soort bij waarneming.nl gemeld wordt. Waar die aantallen staan, nog nagaan (de regiolijsten hebben ze niet; misschien de soortpagina of de statistieken van de API).
- Alleen extra gegevens: het opzoeken uit laag 1 blijft voor de rest.

### Laag 3: niet doen

- **Alle insecten in de prompt:** duizenden soorten maken de prompt groot en geven het model meer kans om vogelnamen door elkaar te halen.
- **Alle insectennamen in de prompt van de spraakherkenning:** die prompt is kort en helpt nu juist bij vogelnamen. Een zeldzame insectennaam wordt daardoor soms verkeerd verstaan; het nalopen thuis vangt dat op.

## Testset

- Laag 1: "een goudhaantje, maar de kever, niet de vogel" (de opname van de tester), "een goudhaantje" (moet de vogel blijven), "een meikever", "twee hommels", "een wants op de brandnetel", "een lieveheersbeestje", "een vliegend hert". Ook in het Engels ("a stag beetle", "two bumblebees").
- Met de keuze uit: niets van dit alles, ook niet de verzamelsoorten.
- Na laag 2 een run met `--soortgroepen` om te zien of de vogels gelijk blijven.

## Besloten (22 nov)

De eigenaar is akkoord met de voorstellen:

1. **Groepen in laag 1:** kevers, wantsen, bijen/wespen/mieren, nachtvlinders, sprinkhanen en zweefvliegen. Geen muggen en vliegen in het algemeen, geen "Insecten (overig)".
2. **Dezelfde keuze** "Ook andere dieren inspreken" (eerst als ontwikkeloptie `insecten`).
3. **Laag 2 in april**, na een maand meten met laag 1.

## Gebouwd (22 nov)

Laag 1 in één PR (de stappen 1–3 hieronder samen, omdat ze los niets doen), als ontwikkeloptie `insecten`:

- Gegevens: verzamelsoorten in `soorten-nl.json` en `soorten-nl-alle.json` (13 stuks; "Wesp onbekend", "Nachtvlinder onbekend" en "Mot onbekend (microvlinder)" met een eigen naam), de volledige lijsten in `data/soorten-insecten.json` (4520 soorten), attributen per groep. Zweefvliegen: de soorten met "zweefvlieg" in de naam plus een vaste lijst geslachten (blinde bij, pendelvlieg, hommelreus).
- Opzoeken: `findInsect` (vocab.ts) zoekt in de groep van de verzamelsoort, ook op de naam zonder "(kever) onbekend", in het meervoud, met een tikfout, en in het Engels.
- Prompt NL en EN: een kopje "Insecten" met welke verzamelsoort bij welk woord hoort, de codes per groep, de verzamelsoorten onder "### Insecten" in de soortenlijst. Alleen als de optie aan staat (eigen variant en promptversie).
- Soortveld: met de optie aan ook alle insecten.
- Proef op 22 nov met 14 zinnen tegen het model: 13 goed ("goudhaantje, de kever" → Goudhaantje (kever) onbekend; "een goudhaantje" → Goudhaan; aardhommels, vliegend hert, kolibrievlinder, blinde bij, Engelse namen; "een spin" → niets). Niet goed: "een rups van de rietvink, de nachtvlinder" → Nachtvlinder onbekend (rups, onzeker) zonder op te zoeken.

Nog te doen: op de telefoon proberen, testset-opnames verzamelen (zie Testset), daarna voor iedereen.

## Stappen

1. Gegevens: `fetch-species.mjs` voor de insectengroepen, lijsten in een eigen bestand, attributen per groep (één PR, met tests op de lijsten).
2. Opzoeken met groep in `findVagrant`, verzamelsoorten en de regel in beide prompts, nieuwe promptversies; testset-gevallen (één PR, met testset-run).
3. Soortveld met het los geladen bestand; uitleg en changelog (één PR).
4. Ontwikkeloptie bij de eigenaar; daarna voor iedereen onder "Ook andere dieren inspreken".
5. Voorjaar: meten, de korte lijst kiezen (laag 2).
