# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen.

## Waar ik ben

- Onderzoek waarneming.nl afgerond en gemerged (PR #1): importformaat, soortenlijst (`data/soorten-nl.json`) en codes (`data/attributen-vogels.json`, `docs/waarneming-nl.md`).
- Nog geen app-code: stap 1 van de bouwvolgorde in `CLAUDE.md` is nog niet begonnen.

## Volgende stap

1. Projectopzet: PWA-skelet, IndexedDB, sessies starten/stoppen, deploy naar Cloudflare Pages.

## Open vragen / losse eindjes

- Biedt de importpagina van waarneming.nl (alleen ingelogd) andere formaten dan eBird-CSV?
- Branch `onderzoek-waarneming-nl` is gemerged en kan op GitHub weg.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen (`.dev.vars`, `.env`) staan niet in git; per computer zelf aanmaken.
