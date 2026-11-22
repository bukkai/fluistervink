# Draaiboek 3: trektelling en tuintelling

Proeven met de microfoon die blijft aanstaan: de trektelling met het scherm uit en de tuintelling. Vink af wat werkt; schrijf bij een afwijking op wat je zag en spreek het in als feedback. Na afloop delen en `npm run feedback -- pull`. Een punt dat werkt, gaat uit `NOTES.md`; als alles af is, gaat dit draaiboek naar `docs/archief/`.

Duur: twee keer ongeveer een half uur. Een plek waar af en toe vogels langskomen (raam, balkon, tuin).

## Uitslag 22 nov (A)

Trektelling 20:51–21:07 met het scherm uit (beta, v0.6 met `ZichtbareWebView`), 16 stukken. **Het werkt:** elk stuk werd meteen verwerkt terwijl het scherm op slot zat (`hidden: false`, `bridgeMs` 22–47, 8–20 s na het einde van een stuk binnen), `screen_off_webview_zichtbaar` met `tegengehouden: 2`, accu 40 → 38% in 16 min. `page_frozen` alleen twee keer, bij het aanzetten van het scherm. Twee keer een time-out van de spraakherkenning (36 s); de wachtrij probeerde het opnieuw en het stuk kwam alsnog binnen (70 en 77 s). Geen nieuwe tag nodig: #312 zit al in v0.6. B (tuintelling) en C nog niet gedaan; `walk_service_failed` kwam in deze sessie niet voor.

Gevonden in de uitspraken:

- **Feedback in een trektelstuk werd uitgevoerd** (21:04): "Feedback, … ik geloof dat ik bedoelde te zeggen dat er één graszanger ter plaatse was … die grasmussen hadden niet aangepast moeten worden" → het model zette een deel in een dev note én paste de waarneming aan (aantal 1, ter plaatse). Wat in feedback staat, hoort nooit een actie te worden.
- **"Graszanger verplaatsen"** (21:00) veranderde de drie grasmussen van 20:53 in één graszanger (onzeker). De reden bij de waarneming was te lang en onduidelijk ("Gezegd: graszanger, opgevat als grasmus van net; verplaatsing zonder nieuwe plek niet vastgelegd; Zeldzame soort (Graszanger): klopt het?").
- Klein: "die zilverplevieren van eerder, dat waren eigenlijk goudplevieren" (er waren geen zilverplevieren) werd een nieuwe goudplevier (onzeker); "Amerikaanse robin" werd Vogel onbekend (niet gevonden bij de dwaalgasten); lieveheersbeestjes en het goudhaantje (kever) kwamen niet binnen omdat de ontwikkeloptie `insecten` uit stond.
- Goed: afschermen (kerkuil, spreeuwen op 1 km), "ongedaan maken" en daarna "doe toch maar wel" (redo), "two mistle thrushes" en "no, make that three", plekken met afstand en richting, "Corvus monedula" en "Pica pica", het BSN weggelaten bij het delen (#335).
- Instellingen: de tuintelling hoort bij Tellen, naast de trektelling (nu nog een ontwikkeloptie; meenemen als hij voor iedereen wordt).

## A. Trektelling met het scherm uit, WebView zichtbaar (#312)

Tot nu toe zet Chromium de webcode een minuut na het vergrendelen stil: alles komt binnen, maar pas bij het ontgrendelen, en zonder tril. #312 laat de WebView zich in beeld melden, zodat elk stuk meteen verwerkt wordt.

**Voorbereiding**

- [ ] `apk/fluistervink-0.990-webview-zichtbaar.apk` geïnstalleerd (of een beta-tag met #312).
- [ ] Ontwikkeloptie `schermUit` aan.
- [ ] Gesproken bevestiging aan (makkelijker te merken dan een tril).
- [ ] Accu noteren: …%.

**Tellen**

- [ ] Sessie starten, trektelling starten, scherm vergrendelen, telefoon wegleggen.
- [ ] 10–15 minuten tellen; spreek elke minuut of twee iets in.
- [ ] Na elk stuk van een minuut: komt de tril of de gesproken bevestiging meteen? Ook na de eerste minuut (daar ging het tot nu toe mis).
- [ ] Ontgrendelen: de app doet normaal, geen dubbele waarnemingen, geen vreemde melding.
- [ ] Trektelling stoppen. Accu noteren: …%. (Vorige keer 0% in 12 minuten.)
- [ ] Plekken: geen stukken zonder plek, geen ±200 m meer (#310).
- [ ] Sessie stoppen en delen.

**In het log kijken**

- [ ] Geen `page_frozen`.
- [ ] `trektel_stuk` met `hidden: false` en een kleine `bridgeMs`.
- [ ] `screen_off_webview_zichtbaar` met `tegengehouden` ≥ 1.
- [ ] Accu in `trektel_native_end`.

**Uitkomst**

- Werkt het: een nieuwe tag voor de beta.
- Kost het merkbaar accu of doet de app raar na het ontgrendelen: `KEEP_WEBVIEW_VISIBLE` in `screenOff.svelte.ts` op false (geen nieuwe APK nodig).

## B. Tuintelling (#332)

Ontwikkeloptie `tuintelling` aan. Bij het raam of in de tuin.

**Starten en tellen**

- [ ] Op het beginscherm "Tuintelling: een half uur tellen".
- [ ] De kop zegt "Tuintelling: het half uur begint als je begint met tellen"; de klok loopt nog niet.
- [ ] "Begin met tellen": de klok loopt, de microfoon blijft aan, er komen stukken per minuut.
- [ ] Een paar vogels inspreken, ook een overvliegende ("drie overvliegende kauwen").
- [ ] Tussendoor stoppen: "Verder luisteren" verschijnt; tik erop, de klok is doorgelopen (niet opnieuw begonnen).
- [ ] Na 30 minuten drie lange trillen en het resultaat.

**Resultaat**

- [ ] "Begonnen op … om …" is het begin van het tellen, niet van de sessie.
- [ ] Per soort het hoogste aantal dat je in één keer noemde.
- [ ] Overvliegende staan apart onder "Overvliegend, telt niet mee".
- [ ] Een onzekere heeft het merkje "onzeker" en de hint om hem eerst na te lopen.
- [ ] "Nog iets inspreken" → een vogel inspreken → Klaar: hij staat in het resultaat.
- [ ] "Kopiëren" geeft een tekst met datum, begintijd en de soorten.
- [ ] "Naar het telformulier" opent de site van de telling.

**Met huisgenoten of de tv aan** (`docs/plan-tuintelling.md`, punt 9)

- [ ] Een tweede telling met praten of de tv op de achtergrond.
- [ ] Komen er vogels binnen die niemand zag (uit de tv, uit een gesprek)?
- [ ] Hoeveel stukken zonder vogels gingen toch naar het model (kosten)?
- [ ] Sessie(s) delen.

## C. Uit de proef van 20 nov

- [ ] Bij een gedeelde sessie met een loopsessie in het log zoeken naar `walk_service_failed` (`draait: false`). Kwam hij terug? Om 12:58 op 20 nov stond hij er twee keer, zonder dat er iets merkbaar misging.

## Afsluiten

- [ ] Alles gedeeld; `npm run feedback -- pull`.
- [ ] Bevindingen in `NOTES.md`; werkende punten daar weghalen.
