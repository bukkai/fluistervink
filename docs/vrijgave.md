# Vrijgave per onderdeel

Wat met de lancering meegaat naar stable en productie, wat achter een schakelaar wacht, en hoe elk wachtend onderdeel apart getest en gelanceerd wordt. Opgezet op 24 nov 2026, vóór de laatste release naar stable. Houd dit bij als een onderdeel van status verandert; de stand van de proeven staat in `NOTES.md`.

## De regel

- **Eén schakelaar per onderdeel.** Wat nog niet goed genoeg is, staat achter een eigen ontwikkeloptie (`src/lib/devOptions.ts`, alleen de eigenaar) of, als het native is en Google er een verklaring voor wil, alleen in de beta-build. Twee onderdelen die samen getest moeten worden, krijgen toch elk een eigen schakelaar (zoals "scherm uit" en "knop op de oortjes", #372), zodat een fout in het ene het andere niet tegenhoudt.
- **Lanceren is een eigen PR per onderdeel**, die alleen dat onderdeel aanzet: de ontwikkeloptie wordt een keuze bij Instellingen (`src/lib/preferences.ts`) of gaat gewoon aan, met een regel in de changelog en, als er gegevens een nieuwe kant op gaan, in `#privacy`. Daarna `npm run release`. Zo is elke lancering apart terug te draaien.
- **Native onderdelen** die nog niet naar de testers mogen, staan uit in de stabiele build (`android/app/src/stable/AndroidManifest.xml`, of de plugin wordt niet geregistreerd). Lanceren is dan: de regel daar weghalen, een nieuwe tag (`v0.*`), en beide AAB's uploaden (`docs/google-play.md`).
- **Prompt en tools** gelden meteen voor iedereen die de nieuwe webcode krijgt. Een kleine verbetering mag mee als de testset hem laat zien; een grotere (een nieuwe soortgroep, een nieuwe taal) komt achter een ontwikkeloptie, zoals `insecten` en `english`.

## Mee met de lancering

Alles wat op `main` staat zonder schakelaar. Testers krijgen het met de volgende `npm run release`; productie is daarna dezelfde stabiele versie. Daarvoor is geen nieuwe app-versie nodig; v0.7 is er voor opnemen met het scherm uit (hieronder).

| Onderdeel | Getest | Nog te doen |
| --- | --- | --- |
| Model: dezelfde soort is een nieuwe waarneming, feedback wordt nooit uitgevoerd, "lifer", "die hadden we al" (#342, #346, #351, #356) | testset | `draaiboek-testen.md`, 2.1 |
| Afschermen en embargo, "onbekend aantal" (#336–#345) | draaiboek thuis H, 22 nov | |
| Nalopen: soortveld, aanpassen maakt zeker (#344, #347) | draaiboek release R, 23 nov | |
| Stop tijdens het inspreken bewaart de opname (#366) | test | |
| Anonieme cijfers per sessie, verbruik met labels, soort toestel (#353–#355, #367), met een schakelaar bij Instellingen | draaiboek release R | na de release: Statistieken volgen |
| Privacypagina in lagen (#368) | | lezen op `/privacy` na de release |
| Voorpagina op `/`, de app op `/app/` (#326) | beta sinds 21 nov | na de release: de stabiele Android-app en een geïnstalleerde PWA openen meteen de app |
| Android en iOS uit elkaar in de webcode (#359) | draaiboek release R | |
| Easter eggs: toch een buizerd, de lifer (#350) | | |
| Scherm aan houden tijdens een sessie (#328) | draaiboek thuis D | |
| Trektelmodus zonder "proef" (#320) | | |
| Gesproken bevestiging: blijft een **proef** bij Instellingen, standaard uit | met oortjes en het scherm aan | het probleem van 24 nov zat waarschijnlijk in de knop op de oortjes (#372), die niet meegaat; de Engelse stem is native en wacht op het Engels |

**Met v0.7 (#374), de nieuwe app-versie voor productie:** opnemen met het scherm uit, als keuze bij Instellingen (standaard uit): de volumeknop werkt dan ook met het scherm uit, en een trektelling telt door in de service. Getest: een lange telling (24 nov, ~10% accu per uur, geen gaten), bellen en Merlin met de service (dezelfde pauze bij een andere app, met het scherm aan of uit). De knop op de oortjes gaat niet mee (hieronder).

Voor productie, pas na de goedkeuring van Google: #362 ("nieuw" in plaats van "nog in ontwikkeling") en #363 (link naar Google Play op de voorpagina), daarna `npm run release`.

## Wacht nog

Elk met een eigen schakelaar. De volgorde na de lancering staat in `docs/roadmap.md`; per onderdeel wat er nog moet en hoe het gelanceerd wordt.

### Knop op de oortjes (`oortjesKnop`, #372)

Met "scherm uit" aan start en stopt ook de knop op de oortjes een opname. Daarvoor claimt de app de mediaknop met een kort stil geluid.

- **Soort:** native (vanaf v0.7) en web. Hangt af van de keuze "Opnemen met het scherm uit" (v0.7).
- **Bekend probleem:** bij een koptelefoon met twee apparaten (Sony XM5) stopt de muziek van het andere apparaat, en de koptelefoon stuurt zelf een pauzetoets die als druk telde. Mogelijk ook de reden dat de gesproken bevestiging niet klonk.
- **Nog testen:** de proef in #372, met de optie aan en uit (`draaiboek-testen.md`, 1.5). Dan beslissen: alleen claimen als er niets speelt, of de knop alleen voor wie hem aanzet.
- **Lanceren:** als aparte keuze bij Instellingen ("Ook de knop op de oortjes"), standaard uit.

### Microfoon van de oortjes (`oortjesMicrofoon`, #267)

Opnemen met de microfoon van Bluetooth-oortjes in plaats van die van de telefoon.

- **Soort:** web en native (de toestemming "Apparaten in de buurt"). De plugin zit sinds v0.7 in beide builds, maar de stabiele build haalt de toestemming sinds v0.8 uit het manifest (`android/app/src/stable/AndroidManifest.xml`), zodat Play hem niet aan iedereen vraagt. Bij de lancering: die twee regels weghalen, een nieuwe app-versie, en de rubriek Gegevensveiligheid in Play nalopen.
- **Nog testen:** `draaiboek-testen.md`, 2.3: op 24 nov ging ronde 2 via de service, dus met de telefoonmicrofoon. Daarna de rondes door de testset: kost Bluetooth herkenning?
- **Open vraag:** moet de trektelling in de service ook de oortjes gebruiken (`setPreferredDevice` in `TrektelOpname`, native)?
- **Lanceren:** pas als de testset laat zien dat het niet slechter verstaat; plugin in de stabiele build, nieuwe tag, keuze bij Instellingen.

### Tuintelling (`tuintelling`, #323–#349)

Een half uur tellen met een resultaat per soort (`docs/plan-tuintelling.md`).

- **Soort:** web. Gebruikt de trektelmodus (die is voor iedereen); met het scherm uit alleen met de keuze "Opnemen met het scherm uit".
- **Nog testen:** de woorden van beginners ("duif", "mus", "mees"; `draaiboek-testen.md`, 2.5), de kinderstem (`draaiboek-testen.md`, deel 4, begin december), en de fixes van 22 nov bij een volgende telling.
- **Open:** de beslissingen onderaan het plan, na het gesprek met Vogelbescherming.
- **Lanceren:** vóór de Nationale Tuinvogeltelling (29–31 jan 2027): de knop op het startscherm voor iedereen, met uitleg en changelog.

### Insecten (`insecten`, #334)

Ook kevers, wantsen, hommels, bijen, wespen, nachtvlinders, sprinkhanen en zweefvliegen (`docs/plan-insecten.md`).

- **Soort:** web, verandert de prompt. Hangt af van de keuze "Ook andere dieren inspreken".
- **Nog testen:** de testset met `--insecten` op echte opnames.
- **Lanceren:** de optie als keuze bij Instellingen, onder "Ook andere dieren", standaard uit.

### English (`english`)

Schermen en inspreken in het Engels (`docs/plan-engels.md`).

- **Soort:** web, eigen prompt; de Engelse stem van de gesproken bevestiging is native.
- **Nog testen:** stap 4, een Engelse testset met Engelstalige sprekers.
- **Lanceren:** een taalkeuze bij Instellingen; pas na de betaalde laag (`docs/roadmap.md`, punt 8).

### Elders, niet in deze app-versie

- **Wake word:** geparkeerd op een eigen branch (#290), eerst een proef die alleen logt.
- **iPhone-app:** eigen schil in `ios/` (#360), eigen lancering in de App Store (`docs/plan-ios.md`).
- **Spanje** (`spanje`): de proef is voorbij; de optie verdwijnt als hij uit staat.
