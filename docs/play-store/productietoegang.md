# Aanvraag productietoegang en teksten voor de lanceringsdag

Concept van 25 nov 2026, voor `docs/lancering.md`, punt 5. De vragenlijst staat in de Play Console bij Dashboard → **Productietoegang aanvragen**, zodra de gesloten test 14 dagen met 12 testers heeft gelopen. De antwoorden zijn in het Engels: de beoordelaars van Google lezen dat het makkelijkst. Geen namen van testers: deze map is publiek.

**Vlak voor het indienen bijwerken:** de cijfers tussen `[ ]` uit Statistieken en Developer, en de feedback van na 25 nov (`npm run feedback -- pull` en `notes`, Discord, mail). De gedeelde cijfers hieronder zijn van de feedback-pull van 25 nov, zonder de eigenaar: 22 installaties, 49 sessies, 453 uitspraken, 511 waarnemingen. Dat is alleen wat testers zelf deelden; de anonieme cijfers per sessie op Statistieken tellen ook wie niet deelt.

De vragen staan hier zoals Google ze ongeveer stelt; de precieze vorm kan anders zijn. Bij een vraag met keuzes staat de keuze erbij.

## Deel 1: de gesloten test

### How did you recruit users for your closed test?

Keuze: vrienden en familie / eigen netwerk, plus een community.

> I recruited testers among birdwatchers in my own network and through a small Discord server for the app, where testers also report problems. Before the closed test on Google Play, a group of birdwatchers had been using the web version since October 2026, and most of them moved to the Play version when the closed test started. New testers who asked to join were added during the test.

### How easy was it to recruit testers?

Keuze: redelijk makkelijk (het midden van de schaal of één erboven). Toelichting als er ruimte is:

> Birdwatchers were enthusiastic about the idea of logging sightings by voice. The hard part was installation: a tester has to use the Google account that is on the tester list, and a few testers needed a second attempt.

### Describe the engagement you received from testers during your closed test.

> Testers used the app on real birding trips: walks, bike rides, migration counts and garden watching. Testers who chose to share their sessions with me shared 49 sessions with about 450 spoken notes and 510 observations from 22 installations. Usage across all installations was higher: [X] sessions from [Y] active installations in the anonymous statistics. Several testers used it repeatedly over several weeks, and some used the export to waarneming.nl, the Dutch national observation database, for real. Testers gave feedback in the Discord server, and in the app itself by starting a spoken note with "feedback", which reaches me with the session. I also used the app myself almost daily (150 sessions) to reproduce what testers reported.

### Provide a summary of the feedback you received and how you collected it.

> Feedback came through the Discord server, through spoken feedback in the app (shared together with the session, including the recording if the tester allowed it), and by email. The main themes were:
>
> - Speech recognition sometimes confused similar bird names.
> - Importing the export file into waarneming.nl failed at first, because some terms were in English.
> - Testers wanted to use the app without holding the phone: phone in a pocket, on a bike, with gloves.
> - Requests for scientific names, adding a location to a sighting ("buzzard 100 m to the east"), copying an observation, deleting recordings, and keeping the screen on during a session.
> - Hiding the location of sensitive species, as waarneming.nl allows.
> - Privacy questions about what happens to the voice recordings.
> - Testers liked how fast logging is: one wrote it was easier than the app they normally use, another called the migration count mode "really handy".

## Deel 2: de app

### Who is the intended audience of your app?

> Recreational birdwatchers in the Netherlands and Belgium, adults, who record their sightings on waarneming.nl or eBird. They are often walking or cycling with binoculars in their hands and do not want to type on a phone in the field.

### Describe how your app provides value to users.

> Fluistervink lets birdwatchers log what they see and hear by speaking, the way they would tell a fellow birder ("six house sparrows flying over", "no, a chaffinch instead"). The app records time and location at the moment you speak, turns the sentence into structured observations (species, count, behaviour), and confirms with a vibration so you don't have to look at the screen. Corrections work by voice as well. At home, you check the list and export it in one file for waarneming.nl or eBird. Everything is stored on the phone first, so it also works without mobile coverage. No account is needed.

### How many installs do you expect in your first year?

Keuze: de laagste reeks (tot 10.000). Bekendheid komt in stappen, eerst in eigen kring (`docs/plan-marketing.md`); de Nationale Tuinvogeltelling eind januari kan een piek geven.

## Deel 3: klaar voor productie

### What changes did you make based on what you learned during the closed test?

> - Speech recognition: switched to a newer transcription model chosen on a test set of real field recordings from several speakers, and added common bird nicknames. Unclear names now become "uncertain" with two or three candidate species to choose from, instead of a wrong species.
> - Export: the file for waarneming.nl now uses Dutch terms, and the import works. An eBird export was added.
> - Hands-free use: the volume button starts and stops a recording, also with the screen off and the phone in a pocket, and a migration count keeps recording with the screen off (an option in Settings).
> - Added on request: scientific names, location in the sentence, copying an observation, deleting recordings, keeping the screen on, hiding or embargoing a sighting by voice, adjusting the location on a map.
> - Reliability: a queue that waits for coverage and keeps the order, a backup in Settings, and recordings are never silently lost.
> - Privacy: a clearer privacy page. Number sequences and email addresses are no longer included when a session is shared with the developer.

### How did you decide that your app is ready for production?

> I set a definition beforehand: a birdwatcher I don't guide personally can install the app, use it for a whole walk without looking at the screen, and export to waarneming.nl at home without trouble. Testers did exactly that. On a test set of [994] real spoken notes, [85]% come out right without any correction, and most of the rest are fixed by a spoken correction in the field. Before release I did a full review of the code and the data flows. Server-side limits per installation and per day keep costs under control, and I get an alert if a limit is reached. Remaining issues from testers were fixed or are tracked.

## Teksten voor de lanceringsdag

### Release notes, eerste productierelease

Hooguit 500 tekens per taal.

```
<nl-NL>
De eerste openbare versie van Fluistervink. Spreek je vogelwaarnemingen in, met de knop of de volumeknop, ook met het scherm uit. Thuis loop je de lijst na en exporteer je hem naar waarneming.nl of eBird.
</nl-NL>
<en-US>
The first public version of Fluistervink. Log your bird sightings by voice, with the button or the volume key, even with the screen off. At home, check the list and export it to waarneming.nl or eBird.
</en-US>
```

### Bedankmail aan de testers

BCC vanuit de e-maillijst van de gesloten test, op de dag dat de app openbaar is (`docs/plan-testers.md`, stap 1).

> **Onderwerp:** Fluistervink staat in Google Play, dank je wel!
>
> Hoi,
>
> Fluistervink staat sinds vandaag openbaar in Google Play. Dat kon alleen dankzij jullie: Google laat een nieuwe app pas toe na een test van twee weken met minstens twaalf testers, en jullie waren dat.
>
> Je hoeft niets te doen. De app blijft gewoon werken, met al je sessies, en de updates komen voortaan uit de gewone Play Store. Je kunt je afmelden als tester, maar dat hoeft niet.
>
> Wat jullie meldden, heeft de app echt beter gemaakt: de import in waarneming.nl, de volumeknop en opnemen met het scherm uit, afschermen met de stem, en een hoop verbeteringen in het verstaan.
>
> Wil je nieuwe dingen eerder blijven uitproberen? Over een tijdje komt daarvoor een uitnodiging in de app. Feedback blijft welkom, via Discord of via Feedback in het menu.
>
> Vertel het gerust door aan andere vogelaars: https://fluistervink.nl
>
> Groet,
> Stephan
