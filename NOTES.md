# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen.

## Waar ik ben

- Onderzoek waarneming.nl afgerond en gemerged (PR #1): importformaat, soortenlijst (`data/soorten-nl.json`) en codes (`data/attributen-vogels.json`, `docs/waarneming-nl.md`).
- Stap 1 (projectopzet) op branch `projectopzet`: Vite + Svelte 5 + TypeScript + Dexie, PWA, wandelingen starten/stoppen. Lokaal getest.

## Volgende stap

1. PR van `projectopzet` reviewen en mergen.
2. Cloudflare Pages koppelen aan de GitHub-repo (build: `npm run build`, output: `dist`), en de app op de telefoon installeren.
3. Stap 2: proxy (Cloudflare Worker) voor de API-sleutels. Overwegen: app en proxy samen als één Worker met static assets in plaats van Pages.

## Open vragen / losse eindjes

- Biedt de importpagina van waarneming.nl (alleen ingelogd) andere formaten dan eBird-CSV?
- Branch `onderzoek-waarneming-nl` is gemerged en kan op GitHub weg.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen (`.dev.vars`, `.env`) staan niet in git; per computer zelf aanmaken.
