# Plan: trektelmodus

Voorstel van 8 nov 2026, nog niet goedgekeurd. Aanleiding: tester Maarten doet vaak trektellen en wil langer achter elkaar kunnen inspreken. Nu stopt een opname vanzelf na 3 minuten (`MAX_RECORDING_MS` in `src/lib/ActiveSession.svelte`, op 28 okt verhoogd van 1 minuut).

## Doel

Bij een trektelling blijft de app luisteren zonder dat je steeds de knop indrukt. Wat je zegt wordt in stukken verwerkt, elk met een eigen tijd en plek, net als losse uitspraken nu. Tegelijk kan niemand per ongeluk uren audio opnemen en versturen.

## Waarom niet gewoon de limiet verhogen

- **Tijd en plek:** een opname krijgt de tijd en GPS-positie van het begin. Bij een opname van twintig minuten staat alles op hetzelfde moment, en bij trektellen telt juist het tijdstip.
- **Alles of niets:** een opname staat tot het stoppen alleen in het geheugen (`chunks` in `src/lib/recorder.svelte.ts`). Valt de app weg, dan is het hele stuk weg.
- **Feedback pas achteraf:** de tril komt na het stoppen, dus je weet lang niet of iets is begrepen.
- **Model en spraakherkenning:** een lang transcript met tientallen waarnemingen geeft meer fouten. Ook spraakherkenning kort lange audio soms in (niet zelf getest).
- **Grootte:** de proxy neemt hooguit 10 MB aan (`MAX_AUDIO_BYTES`, bij 32 kbit/s ongeveer 40 minuten). Delen met de ontwikkelaar heeft dezelfde grens.
- **Wachtrij:** uitspraken gaan één voor één, dus een lange opname houdt de rest op.

Stukken van een paar minuten lossen dit allemaal op. Daarom geen langere limiet, maar automatisch doorgaan.

## Wat niet verandert

- De gewone werkwijze (knop indrukken, inspreken, loslaten) blijft de standaard. De trektelmodus staat uit tot je hem bij Instellingen aanzet.
- Elk stuk is een gewone uitspraak: eerst lokaal bewaard, dan verwerkt, op volgorde. Correcties als "nee, keep" en "nog drie erbij" werken ook over de grens van een stuk, want het model krijgt de laatste waarnemingen al als context.
- Export, review en nalopen blijven gelijk.

## De aanpak

### 1. Stukken knippen bij een pauze

- De microfoon blijft aan zolang de modus loopt. Per stuk start een nieuwe `MediaRecorder` op dezelfde stream, zodat elk stuk een los, afspeelbaar bestand is en er geen gat valt tussen twee stukken.
- Het geluidsniveau wordt gemeten met een `AnalyserNode` (Web Audio). Na ongeveer 60 seconden knipt de app bij de eerstvolgende pauze (bijvoorbeeld 0,7 s stil). Komt er geen pauze, dan knipt hij hoe dan ook na 3 minuten, de huidige limiet.
- Elk stuk krijgt de tijd en positie van zijn eigen begin (`currentPosition()` bij de start van elk stuk, zoals nu bij de knop).
- Het herkennen van stilte en het kiezen van het knipmoment komen in een losse functie zonder browser-API's, zodat er een test voor kan.

### 2. Stilte niet versturen

- Een stuk waarin vrijwel geen spraak zit (te weinig tijd boven de geluidsdrempel), gaat niet naar de spraakherkenning. Het wordt niet bewaard, alleen gelogd (`events`, met duur en gemeten niveau), zodat in de testset te zien is of de drempel goed staat.
- Dit scheelt kosten en is de belangrijkste bescherming: wie de modus vergeet en de telefoon wegstopt, verstuurt dan bijna niets.
- De drempel voorzichtig kiezen. Liever een stuk wind versturen dan een zacht ingesproken "twee sperwers" weggooien. Afstellen met echte opnames van een telpost (wind, andere tellers in de buurt).

### 3. Beveiligingen tegen per ongeluk uren opnemen

- **Expliciet aanzetten, twee keer:** de instelling "Trektelmodus" bij Instellingen (met uitleg wat het doet en kost), en daarna per wandeling een aparte knop "Trektelling starten" op het wandelscherm. De modus gaat nooit vanzelf aan, ook niet bij een volgende wandeling.
- **Altijd zichtbaar:** zolang hij loopt een opvallende balk met "Trektelling loopt", de lopende tijd en de knoppen **Pauze** en **Stop**. Pauze zet de microfoon uit, bijvoorbeeld tijdens een gesprek met een andere teller.
- **Af en toe vragen:** elke 45 minuten een eigen trilpatroon en de vraag "Telling loopt nog?". Geen tik binnen 5 minuten, dan stopt de modus.
- **Stoppen na lange stilte:** 15 minuten geen spraak, dan stopt de modus (met een tril).
- **Hard maximum:** 4 uur per keer. Daarna stopt de modus. Opnieuw starten kan, met een tik.
- De gewone wandeling loopt door als de modus stopt; je kunt weer met de knop inspreken.

### 4. Scherm aan

Een opname stopt nu als het scherm op slot gaat (bewust zo gelaten, zie `docs/plan-capacitor.md`, fase 2). In de trektelmodus houdt de app het scherm daarom aan met de Wake Lock API, met een gedimd scherm als dat kan. Dat kost accu. Opnemen met het scherm uit kan pas met de native opname uit fase 3 van het Capacitor-plan, en hoort niet bij dit plan.

De microfoon blijft in deze modus continu bezet. Merlin kan er dan niet tussendoor bij (nu gaat de microfoon na elke opname uit). Dat moet in de uitleg bij de instelling staan.

### 5. Plafond in de proxy

- Een maximum aantal minuten audio per tester per dag, in de proxy. Het verbruik staat al per dag en tester in D1 (`worker/usage.ts`). Bij `gpt-4o-transcribe` telt dat in tokens, dus de app stuurt de duur mee of de proxy schat die uit de bestandsgrootte.
- Voorstel: 5 uur per dag, de eigenaar uitgezonderd. Boven het plafond geeft `/api/transcribe` een eigen foutmelding, en de app stopt de modus met uitleg in plaats van stukken te blijven proberen.
- Hier kan later een premium-abonnement aanhaken: een hoger plafond of de modus zelf alleen voor wie betaalt.

### 6. Meten, uitleg en privacy

- Bij elke uitspraak bewaren of hij uit de trektelmodus kwam, zodat de testset en de kosten op Developer het onderscheid zien.
- `#uitleg`: hoe de modus werkt, de knoppen, het trilpatroon van de controlevraag.
- `#privacy`: continu opnemen legt ook stemmen van anderen vast. Stilte wordt niet verstuurd, maar spraak van omstanders wel.
- Tests: de knip- en stiltelogica, het plafond in de proxy, en het stoppen van de modus (controlevraag, lange stilte, maximum).

## Kosten

De spraakherkenning rekent per minuut audio. Bij `gpt-4o-transcribe` is dat in de orde van een halve cent per minuut, dus rond de $0,35 per uur ononderbroken spraak (vóór de bouw nagaan in de prijstabel van `src/lib/costs.ts`). Doordat stilte niet wordt verstuurd, kost een rustige telling veel minder. Het model (Haiku) kost per stuk weinig. Een telling van een ochtend komt waarschijnlijk uit op tientallen centen.

## Fasen

1. **Knippen en doorgaan** (punt 1, 2 en 4), achter de instelling, alleen zichtbaar voor de eigenaar en Maarten. Proef op een telpost met Maarten: knipt hij goed, gaat er geen spraak verloren, klopt de stiltedrempel.
2. **Beveiligingen en plafond** (punt 3 en 5). Pas daarna de instelling voor iedereen.
3. **Uitleg, privacy, meten** (punt 6). Kan samen met fase 2 in één PR.

Elke fase is één PR.

## Open punten

- **Antwoorden van Maarten** (8 nov): hij legt de telefoon naast zich op een verhoging en zegt alles wat hij ziet. Dat is precies deze modus: een vaste post, dus de positie per stuk is vrijwel gelijk, en de knop indrukken is onhandig. Scherm aan is bij het trektellen geen probleem. Hij telt nu vooral met de Live Atlas-app van Sovon (ook voor BMP en atlasblokken), gekoppeld aan zijn account bij waarneming.nl. Hij test graag mee, dus de proef uit fase 1 doet hij.
- **Nog te vragen:** liep hij tegen de 3 minuten aan, of was het vooral het steeds indrukken van de knop?
- **Trektellen.nl:** trektellers melden vaak daar, met tellingen per uur of tijdvak. Maarten vindt een export daarheen "een goede extra optie". Los van dit plan, later uitzoeken (importformaat van trektellen.nl).
- **Fietsen met oortjes (buiten dit plan):** Maarten wil ook op de fiets waarnemingen roepen via de microfoon van zijn oortjes, met het scherm uit. Daarvoor zijn twee dingen nodig die er nog niet zijn: opnemen met het scherm uit (de native opname uit fase 3 van `docs/plan-capacitor.md`) en een manier om een opname te starten zonder scherm: de knop op de oortjes (mediasessie) of later het wake word. Let op: de app neemt nu bewust op met de microfoon van de telefoon en niet met die van een Bluetooth-headset (fase 0 van dat plan, tegen het haperen van audio), dus de microfoon van de oortjes vraagt een eigen keuze en een proef. Een sterk argument om fase 3 op te pakken.
- **Gedeelde opnames:** bij delen met de ontwikkelaar kunnen dat bij een trektelling veel stukken zijn. Opnames gaan alleen mee als de gebruiker dat apart aanzet; nagaan of KV en de limiet per tester dat aankunnen.
- **Getallen** (60 s, 0,7 s stilte, 45 en 15 minuten, 4 uur, 5 uur per dag) zijn een eerste voorstel en volgen uit de proef.
