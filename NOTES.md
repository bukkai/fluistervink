# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen.

## Waar ik ben

- Stap 1 (projectopzet) en stap 2 (proxy) gemerged (PR #2, #3, #4).
- Stap 3 (interpretatie met tekstinvoer) gemerged (PR #5) en gedeployd: tijdens een wandeling typ je een uitspraak, Claude Haiku 5.5 zet hem om in tool calls (`add_observation`, `update_observation`, `delete_observation`, `undo`), de app valideert en voert ze uit. Lokaal getest met echte sleutels: 13 testuitspraken (toevoegen, correctie, "nog drie erbij", verwijderen, ongedaan maken, gepraat negeren) gingen allemaal goed, ±2 s per uitspraak. Prompt caching werkt (~6900 tokens uit de cache).

## Volgende stap

1. Op de telefoon uitproberen met eigen zinnen; opvallende fouten noteren voor de prompt.
2. Op elke computer `.dev.vars` aanmaken (zie README).
3. Stap 4: opname en Whisper-koppeling, met tijd en GPS bij start van de opname. De transcriptie komt dan in `utterance.transcript` en loopt verder door dezelfde wachtrij.

## Open vragen / losse eindjes

- Biedt de importpagina van waarneming.nl (alleen ingelogd) andere formaten dan eBird-CSV?
- Branch `onderzoek-waarneming-nl` is gemerged en kan op GitHub weg.
- Cloudflare-previews: branch-builds draaien sinds 9 okt `npx wrangler versions upload` (en falen met "name must match") terwijl Previews Base op `npx wrangler preview` staat. Builds van `main` werken wel. Mogelijke oplossing: repo in het dashboard loskoppelen en opnieuw koppelen, of preview-builds uitzetten.
- Interpretatie: het model laat optionele velden graag weg; daarom zijn activiteit, methode en telmethode verplicht bij `add_observation`. Bij `update_observation` blijven ze optioneel.
- "Ongedaan maken" van een ongedaan-maken wordt niet ondersteund; een tweede "undo" gaat een uitspraak verder terug.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen (`.dev.vars`, `.env`) staan niet in git; per computer zelf aanmaken.
