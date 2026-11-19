# Plan: wake word "Fluistervink"

18 nov 2026. Status: **model trainen en meten, los van de app.** In de app pas na de productierelease en na stap 3 en 4 van `roadmap-android.md` (opnemen met het scherm uit, de microfoon delen), en dan eerst als proef die alleen logt.

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

Zie hieronder per poging. "Herkend" is op aparte synthetische stemmen in apart veldgeluid, dus een schatting: echte stemmen kunnen het slechter doen.

## Volgende stappen

1. **Echte opnames van "Fluistervink"**, van de eigenaar en een paar anderen, elk vijf à tien keer: gewoon, zacht, fluisterend, snel, aan het begin van een zin, buiten met wind, met de oortjes. Eerst om te meten, daarna ook om mee te trainen. Het makkelijkst via de app (dezelfde microfoon), bijvoorbeeld een ontwikkeloptie "Wake word inspreken" die de opnames in de sessie bewaart; met het delen gaan ze mee als opnames delen aan staat.
2. **Proef in de app die alleen logt** (`roadmap-android.md`, stap 5): na stap 3 en 4, met de drie ONNX-modellen in de service. Logt score en tijd bij elke melding; de eigenaar zegt af en toe "Fluistervink" en houdt bij wanneer. Daarna beslissen.
3. `#privacy` en `#uitleg` bijwerken voordat het voor anderen aan kan.
