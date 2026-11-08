# Winkelvermelding in Google Play

Wat er in de Play Console is ingevuld (9 nov 2026), zodat het later na te kijken en bij te werken is. Roadmap: `docs/lancering.md`.

## Feature graphic

`feature-graphic.jpg` (1024×500, JPEG zonder alfakanaal), gemaakt uit `feature-graphic.html` met het huidige logo. Opnieuw maken na een wijziging, of met het nieuwe logo van de artiest:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1024,500 --screenshot=/tmp/fg.png "file://$PWD/docs/play-store/feature-graphic.html"
sips -s format jpeg -s formatOptions 92 /tmp/fg.png --out docs/play-store/feature-graphic.jpg
```

## Categorie

Education (daar staan Merlin, eBird, BirdNET en iNaturalist), met tags over vogels en natuur.

## Gegevensveiligheid

Overal alleen **Collected**, nergens **Shared**: OpenAI, Anthropic, Cloudflare en Google (Play Integrity) verwerken namens ons (service providers); export en back-up doet de gebruiker zelf. "Processed ephemerally" overal **No**: elk type wordt ook ergens bewaard (delen, verbruik).

| Gegevenstype | Required / optional | Purposes |
| --- | --- | --- |
| Precise location | Required | App functionality, Analytics |
| Voice or sound recordings | Required | App functionality, Analytics |
| Other user-generated content | Required | App functionality, Analytics |
| App interactions | Required | Analytics |
| Diagnostics | Required | Analytics |
| Device or other IDs | Required | App functionality, Analytics, Fraud prevention, security, and compliance |
| Name | Optional | App functionality |

Verder: versleuteld onderweg ja; geen accounts; verwijderen aanvragen ja, via `https://fluistervink.nl/privacy`. Bijwerken als gegevens een nieuwe kant op gaan (zelfde moment als `#privacy`).

## Short description

```
Spreek je vogelwaarnemingen in en zet ze thuis op waarneming.nl.
```

## Full description

```
Fluistervink is een notitieboekje voor vogelaars dat luistert. Je drukt op de knop, zegt wat je ziet of hoort, en de app maakt er een waarneming van, met tijd en plek erbij. Je hoeft niet te typen en nauwelijks naar je scherm te kijken: je ogen blijven bij de vogels.

ZO WERKT HET
Begin met vogelen, op een wandeling, op de fiets, in een vogelhut of in je tuin. Zie of hoor je iets, druk dan op de knop en zeg het gewoon:
• "Zes overvliegende houtduiven"
• "Roepje vink"
• "Buizerd, vijfhonderd meter zuid van hier"
• "Fringilla coelebs" (wetenschappelijke namen werken ook)

Fluistervink herkent de soort, het aantal en wat de vogel doet (overvliegend, zingend, roepend, ter plaatse) en legt de tijd en je GPS-positie vast.

VERBETEREN MET JE STEM
Verkeerd verstaan of nog een paar gezien? Zeg het gewoon: "nee, keep in plaats van vink", "nog drie erbij" of "die laatste weg".

ZONDER NAAR HET SCHERM TE KIJKEN
Een korte tril betekent opgeslagen, twee trillen dat de app je niet begreep, en een ander patroon dat het opgeslagen is maar met twijfel. Tijdens een sessie werkt de app door met het scherm uit; de tril komt ook met je telefoon op zak.

THUIS NALOPEN
Na afloop loop je je sessie na. De waarnemingen waar de app aan twijfelde, staan bovenaan: Klopt, Weg of Aanpassen. Je kunt opnames terugluisteren, alles op een kaart zien en de plek van een waarneming met de hand verzetten. Klopt de rest, dan is één tik genoeg.

NAAR WAARNEMING.NL
Nagelopen sessies zet je klaar en exporteer je in één bestand, dat je bij waarneming.nl importeert. Soorten, gedrag en telmethode staan al in de vorm die waarneming.nl verwacht.

GEEN ACCOUNT, GEEN ADVERTENTIES
Fluistervink is gratis, zonder account en zonder advertenties. Alles wat je inspreekt staat eerst op je eigen telefoon. Bij Instellingen maak je een back-up.

OPEN OVER AI
Om je stem te verstaan gaat je opname naar OpenAI, en om er een waarneming van te maken gaat de tekst naar Anthropic. Die gebruiken het niet om hun modellen te trainen. De app kiest alleen soorten uit de soortenlijst van waarneming.nl en verzint geen vogels, maar kan je wel verkeerd verstaan, vooral in de wind. Daarom loop je thuis na. Je hebt internet nodig om in te spreken.

Fluistervink is een persoonlijk project en staat los van waarneming.nl en Observation.org.

Privacy: https://fluistervink.nl/privacy
Vragen of feedback: info@fluistervink.nl
```
