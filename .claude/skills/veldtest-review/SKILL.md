---
name: veldtest-review
description: Bekijkt Fluistervink door de ogen van een vogelaar in het veld — één hand vrij (verrekijker in de andere), fel zonlicht, handschoenen, zwak of wegvallend netwerk — en lost de duidelijke problemen meteen op. Meet knopgroottes en contrast in de browser, loopt na wat er gebeurt als het netwerk wegvalt midden in een uitspraak, en controleert of trilfeedback werkt zonder naar het scherm te kijken. Gebruik deze skill bij elke vraag over bruikbaarheid buiten, veldtest, "werkt dit met handschoenen/in de zon/met één hand", touch targets, contrast, offline/slecht bereik, of als een UI-wijziging aan het opnamescherm, de wandeling of de knoppen klaar is en nog niet in het veld getest — ook als de gebruiker het woord "veldtest" niet noemt.
---

# Veldtest-review

Fluistervink wordt gebruikt tijdens het vogelen: de telefoon in één hand, een verrekijker in de andere, vaak buiten in de zon of de kou, op plekken met slecht bereik. Wat op een bureau prima werkt, kan daar mislukken: een knop die net te klein is voor een duim met handschoen, een grijs label dat in de zon wegvalt, een uitspraak die stil verdwijnt als het netwerk hapert. Deze review zoekt zulke problemen vóór de volgende wandeling, en lost de duidelijke gevallen meteen op.

Lees eerst `CLAUDE.md` (werkwijze, MVP-scope, vormgeving) en `NOTES.md` (recente bevindingen uit het veld). Wat testers al gemeld hebben weegt zwaarder dan wat je zelf bedenkt.

## De vier veldomstandigheden

Bekijk elk scherm dat in het veld gebruikt wordt — vooral de actieve wandeling (`src/lib/ActiveSession.svelte`), de opnameknop, "stop wandeling" en de lijst met waarnemingen tijdens het lopen — vanuit elk van deze situaties. Het nalopen thuis (review, export, Developer) is minder kritisch; noem daar alleen echte problemen.

### 1. Eén hand, duim

De andere hand houdt de verrekijker vast. Alles wat tijdens het lopen nodig is, moet met de duim van één hand kunnen, zonder de telefoon te verschuiven.

- **Doelgrootte:** minstens 48 × 48 CSS-pixels voor alles wat je in het veld aanraakt (Android/Material), met minstens 8 px tussen doelen. Een klein tekstlinkje mag thuis, niet op het wandelscherm.
- **Duimzone:** de belangrijkste knoppen (opnemen, stoppen) in de onderste helft van het scherm. Bovenin is voor een duim lastig te bereiken, zeker op een grote telefoon.
- **Geen gebaren die twee handen of precisie vragen:** knijpen, slepen, lang drukken op een klein doel.
- **Gevaarlijke acties niet naast de opnameknop:** "stop wandeling" of verwijderen moet niet per ongeluk te raken zijn als je snel wilt inspreken; liefst met bevestiging of ongedaan maken.

### 2. Handschoenen

Een handschoen maakt de vingertop groter en minder precies, en sommige touchscreen-handschoenen reageren traag.

- **Primaire knoppen ruimer:** de opnameknop en "stop wandeling" minstens 56–64 px; de opnameknop mag gerust veel groter.
- **Push-to-talk** (`onpointerdown`/`onpointerup`): wat gebeurt er als de vinger tijdens het inspreken een stukje verschuift of de aanraking even wegvalt? Stopt de opname dan halverwege? Kijk naar `pointercancel`, `pointerleave` en `setPointerCapture`.
- **Per ongeluk drukken:** een te korte of lege opname moet stil worden genegeerd (`isAccidental` in `src/lib/observations.ts`), niet als fout trillen.

### 3. Fel zonlicht

In de zon valt contrast weg en zie je kleurverschil slecht. De gebruiker kijkt hooguit een tel naar het scherm.

- **Tekst:** contrast minstens 4,5:1 (WCAG AA); voor statusinformatie die je in het veld moet kunnen lezen (opname loopt, verwerkt, fout) liefst 7:1.
- **Knoppen, randen, iconen, statusvlakken:** minstens 3:1 tegen de achtergrond (WCAG 1.4.11).
- **Niet alleen kleur:** opname, onzeker en fout moeten ook met vorm, tekst of beweging te onderscheiden zijn. Zeldzaamheid heeft al een vorm per niveau; let op nieuwe plekken.
- **Tekstgrootte:** minstens 16 px op het wandelscherm.
- **Donkere modus** apart controleren: `src/app.css` heeft eigen kleuren onder `prefers-color-scheme: dark`.

### 4. Zwak of wegvallend netwerk

Dit is het belangrijkste scenario: een uitspraak die verloren gaat, kost een waarneming die je niet terugkrijgt. De app is local-first: elke uitspraak wordt eerst lokaal bewaard (audio, tijd, GPS) en daarna één voor één verwerkt (`src/lib/observations.ts`: transcriberen via `/api/transcribe`, interpreteren via `/api/messages`).

Loop deze momenten na, en wat de gebruiker merkt **zonder naar het scherm te kijken**:

| Moment | Vragen |
|---|---|
| Netwerk weg vóór het inspreken | Kan opnemen nog? Wordt de uitspraak bewaard? |
| Weg tijdens het uploaden van de audio | Blijft de audio bewaard? Trilt het als fout (`failed`, drie korte)? |
| Weg tussen transcriberen en interpreteren | Gaat het transcript verloren, of wordt het bewaard voor een nieuwe poging? |
| Heel traag (2G, één streepje) | Time-out is 30 s (`src/lib/api.ts`). Blokkeert één hangende uitspraak de rest van de wachtrij? Hoe lang wacht de gebruiker op een tril? |
| Netwerk komt terug | Wat gebeurt er met mislukte uitspraken? Zijn ze na het wandelen nog terug te vinden en opnieuw te verwerken ("Opnieuw" in `SessionLog.svelte`)? |
| GPS zonder netwerk | Komt de positie nog binnen? (`src/lib/location.svelte.ts`) |
| Opstarten zonder netwerk | Werkt de app (PWA-cache), of is een netwerkverzoek (toegangscode, gebied) vereist om te beginnen? |

Let op de MVP-scope: **echte offline-ondersteuning** (automatisch verwerken zodra er weer verbinding is, sync-status) staat in CLAUDE.md onder "bewust niet in de MVP". Een uitspraak die bewaard blijft en later met "Opnieuw" te verwerken is, is dus goed genoeg. Een uitspraak die stil verdwijnt, of een fout zonder tril, is een echt probleem.

### Feedback zonder te kijken

De trilpatronen staan in `src/lib/feedback.ts` en worden uitgelegd in `src/lib/HowItWorks.svelte`. Controleer dat elke uitkomst (opgeslagen, onzeker, niet begrepen, fout) een eigen patroon heeft, dat de uitleg klopt met de code, en dat er geen uitkomst is die helemaal niet trilt. Chrome trilt niet als de app op de achtergrond staat; ga na of dat in het log komt (`vibrate_blocked`).

## Werkwijze

1. **Code lezen.** Begin bij `ActiveSession.svelte`, `src/app.css` (kleuren, `.btn`), `feedback.ts`, `observations.ts`, `api.ts` en `recorder.svelte.ts`. Veel netwerkvragen zijn al met de code te beantwoorden.

2. **Meten in de browser.** Start de dev-server (`preview_start` met `dev` uit `.claude/launch.json`), zet het venster op een telefoon (`resize_window` met preset `mobile`) en maak een testwandeling aan, zodat het wandelscherm met een paar waarnemingen te zien is. Voer dan `scripts/meet.js` uit via `javascript_tool`. Onder de Vite-dev-server laad je het zo, zonder de inhoud over te typen:

   ```js
   const src = await (await fetch('/@fs/<absoluut pad naar deze skill>/scripts/meet.js')).text();
   (0, eval)(src);
   ```

   Het geeft per knop of link de grootte, of die in de duimzone zit, en per tekst het contrast. Doe dit in licht én donker (`resize_window` met `colorScheme`). Meet; schat niet.

3. **Netwerk nabootsen.** De microfoon is in de testbrowser meestal niet te gebruiken, dus test de wachtrij op twee manieren:
   - In de browser met `scripts/netwerk.js` (laden zoals `meet.js`): dat vervangt `fetch` voor `/api/` door een versie die faalt, traag is of halverwege wegvalt; de uitleg staat bovenin het script. Zet daarna een uitspraak in de database (zoals de app dat doet na een opname) en kijk wat de wachtrij ermee doet. Lokaal werkt `/api/` alleen met een `.dev.vars` en een toegangscode in Instellingen; zonder krijg je 401, wat voor het nabootsen van storingen niet uitmaakt.
   - In Vitest, in de stijl van `src/lib/observations.test.ts` (nagebootst model, fake-indexeddb): daarmee test je "weg tussen transcriberen en interpreteren" precies. Een test die een echt probleem laat zien, mag blijven als regressietest.

4. **Opruimen.** Haal testwandelingen weer uit de database en zet `fetch` terug (`window.__netwerk.herstel()` of herladen).

## Rapport

Geef eerst het rapport in de chat, in deze vorm:

```
# Veldtest-review — <datum>

## Samenvatting
<2–3 zinnen: hoe veldklaar is het, wat is het grootste risico>

## Bevindingen
### <Ernst>: <korte titel>
- **Situatie:** één hand / handschoenen / zon / netwerk / zonder kijken
- **Waar:** `bestand:regel` met het echte regelnummer (bv. `src/App.svelte:212`, `.stop`), ook bij CSS-regels in een `<style>`-blok
- **Gemeten:** <getal: 36 × 36 px, contrast 2,8:1, 30 s zonder tril, …>
- **Gevolg in het veld:** <wat de vogelaar merkt>
- **Voorstel:** <concrete wijziging>
- **Opgelost in deze ronde:** ja / nee (waarom niet)

## Wat goed is
<kort: wat je gecontroleerd hebt en in orde is, zodat de volgende review dat niet opnieuw hoeft>
```

Zoek de regelnummers op (`grep -n` op de selector of functie) in plaats van alleen het bestand of de selector te noemen: de eigenaar klikt erop om direct naar de plek te gaan.

Ernst: **Hoog** = een waarneming kan verloren gaan, of de kernactie (opnemen, stoppen) lukt niet betrouwbaar. **Middel** = lukt wel maar met moeite of onzekerheid (te klein, slecht leesbaar, onduidelijke feedback). **Laag** = ongemak of iets dat alleen thuis speelt.

## Meteen oplossen

Los na het rapport de duidelijke problemen op, op een eigen branch met een PR (zie Werkafspraken in CLAUDE.md):

- **Wel meteen:** te kleine doelen vergroten, contrast verbeteren met kleuren uit `src/app.css` (pas een token aan of voeg er een toe, geen losse kleurcodes in componenten), ontbrekende `pointercancel`-afhandeling, een uitkomst zonder tril, uitleg in `HowItWorks.svelte` die niet klopt met de code.
- **Eerst vragen:** alles wat de vormgeving zichtbaar verandert (andere indeling, knop verplaatsen), of buiten de MVP valt (offline-wachtrij, automatisch opnieuw proberen, wake word, achtergrondgebruik). Zet die in het rapport als voorstel.

Houd de rustige vormgeving aan (vinkkleuren, witte kaarten). Nieuwe logica in de wachtrij krijgt een test. Draai voor de PR `npm run format`, `npm run check` en `npm test`, en controleer de wijziging in de browser met dezelfde meting als hierboven, zodat je het verschil in getallen kunt laten zien.
