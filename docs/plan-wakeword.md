# Plan: wake word "Fluistervink"

18 nov 2026. Status: **geparkeerd tot na de release (19 nov).** Een eerste model is getraind en gemeten (hieronder); verder pas met echte opnames van testers (volgende stap 1). In de app pas na de productierelease en na stap 3 en 4 van `roadmap-android.md` (opnemen met het scherm uit, de microfoon delen), en dan eerst als proef die alleen logt.

## Doel

Met de telefoon in de zak "Fluistervink, zes houtduiven" zeggen, zonder knop. De app luistert op de telefoon zelf naar het woord; pas daarna begint een gewone opname. Er gaat nooit doorlopend audio naar een server.

Wat goed genoeg is (voorlopig, bijstellen na de proef):

- **Herkend:** minstens 9 van de 10 keer dat je "Fluistervink" zegt, ook buiten met wind, fluisterend of met de microfoon van de oortjes.
- **Vals:** hooguit één melding per uur. Een valse melding kost een opname die het model als "niets" afdoet, maar wel een tril en een verzoek aan de proxy.

## Keuzes

- **openWakeWord** (open source, Apache-2.0), besloten 11 nov (`roadmap-android.md`, "Besloten"). Porcupine viel af om de licentie.
- **Alleen de kleine classifier trainen we zelf.** De kenmerkmodellen van openWakeWord (melspectrogram en een embedding die op veel spraak is getraind, 96 getallen per 80 ms) blijven zoals ze zijn. Onze classifier kijkt naar 1,28 s aan kenmerken. Samen ~2,5 MB ONNX; draait op Android met `onnxruntime`.
- **Synthetische stemmen om te trainen.** In de testset wordt "Fluistervink" maar drie keer gezegd. Piper (open source) heeft 58 Nederlandse en Vlaamse sprekers die het woord klankmatig goed uitspreken (`f l ˈœy s t ə r v ˌɪ ŋ k`). Een deel van de stemmen houden we apart om te meten.
- **Wat het niet is:** lijkende woorden ("luistervink", "fluisteren", "vink", "goudvink", `wakeword/teksten/lijkt_erop.txt`), het begin of het eind van het woord alleen ("fluister…", "…vink"), de echte veldzinnen uit de testset (door Piper uitgesproken), de veldopnames zelf, en 2000 uur gewone audio van openWakeWord (spraak, muziek, geluid).
- **Meten op wat niet in de training zat:** aparte stemmen, de veldopnames van iedereen behalve de eigenaar (en een deel van de eigenaar), en 10,7 uur gewone audio.
- **In de publieke repo** alleen de scripts (`wakeword/`). Opnames en zinnen van testers, de stemmen en de gedownloade kenmerken staan niet in git (`wakeword/.gitignore`).

Hoe je traint en meet: `wakeword/README.md`.

## Uitslagen

"Herkend" is op aparte synthetische stemmen in apart veldgeluid, dus een schatting: echte stemmen kunnen het slechter doen. "Veld" is 0,74 uur aparte veldopnames (te weinig voor een harde uitspraak per uur), "gewoon" de 10,7 uur gewone audio.

| Poging (18–19 nov) | Drempel | Herkend | Vals veld per uur | Vals gewoon per uur |
| --- | --- | --- | --- | --- |
| 1. Alleen eigen negatieven, groot model (128) | 0,9 | 89% | 191 | – |
| 2. Plus dropout, "…vink" als negatief, klein model (64) | 0,9 | 51% | 0 | 9,4 |
| 3. Plus 2000 uur gewone audio | 0,9 | 56% | 0 | 2,0 |
| 3. | 0,8 | 70% | 0 | 6,2 |
| 4. Plus 9000 extra positieven (12.000) | 0,9 | 73% | 0 | 6,1 |
| 4. | 0,95 | 59% | 0 | 2,1 |
| 5. Groter model (128), 50 rondes, 3 mengsels per positief | 0,98 | 77% | 1,3 | 8,0 |

Poging 4 (`train.py` met de standaardinstellingen) is de beste. Een groter model (5) leert weer de stemmen: meer herkend, maar veel vaker vals.

Wat opvalt:

- **Zonder veel gewone audio leert het model de stemmen, niet het woord** (poging 1: op de trainingsdata bijna perfect, in het veld 191 valse meldingen per uur). De 2000 uur van openWakeWord halveren de valse meldingen op gewone audio bij dezelfde herkenning.
- **Meer stemvariatie helpt het meest voor de herkenning** (poging 4: van 56 naar 73% bij drempel 0,9).
- **De echte veldopnames gaan zelden vals af** (0 per uur vanaf drempel 0,9), ook al zeggen ze vaak "vink". Synthetische zinnen van aparte stemmen gaan veel vaker af (21% bij 0,9); die meting is streng, want het zijn ook nieuwe stemmen, en veel van die zinnen eindigen op "…vink".
- **Echte opnames van de eigenaar** (de enige drie in de testset): in een lange feedbackzin herkend (0,98), "een kraai en een luistervink" niet (0,20, terecht), en een los "Fluistervink." met veel geruis (wind?) nooit (0,00). Dat laatste is zorgelijk: buiten waait het.

**Stand:** ongeveer 75% herkend bij weinig valse meldingen. Het doel (90% bij ≤ 1 per uur) haalt dit met alleen synthetische stemmen nog niet. De grootste stap is nu echte opnames (volgende stap 1).

## Volgende stappen

1. **Echte opnames van "Fluistervink", na de release** (besloten 19 nov): testers vragen het wake word in te spreken met een kaart of pop-up die verschijnt als ze de app weer eens gebruiken. Elk vijf à tien keer: gewoon, zacht, fluisterend, snel, aan het begin van een zin, buiten met wind, met de oortjes. Via de app, zodat het dezelfde microfoon is. Uitwerken: wanneer de kaart verschijnt (niet midden in een sessie), hoe vaak hij terugkomt als iemand "Later" kiest, en hoe de opnames bij de ontwikkelaar komen (mee met het delen, met eigen toestemming, ook als opnames delen uit staat?). `#privacy` en `#uitleg` bijwerken. Eerst om te meten, daarna ook om mee te trainen.
2. **Proef in de app die alleen logt** (`roadmap-android.md`, stap 5): na stap 3 en 4, met de drie ONNX-modellen in de service. Logt score en tijd bij elke melding; de eigenaar zegt af en toe "Fluistervink" en houdt bij wanneer. Daarna beslissen.
3. `#privacy` en `#uitleg` bijwerken voordat het voor anderen aan kan.
