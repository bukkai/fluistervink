# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen.

## Waar ik ben

- Stap 1 (projectopzet) gemerged (PR #2).
- Stap 2 (proxy) op branch `proxy`: één Cloudflare Worker serveert app + `/api`. Endpoints `/api/ping`, `/api/transcribe` (OpenAI), `/api/messages` (Anthropic). Toegangscode in de app onder "Instellingen". Lokaal getest met nep-sleutels.

## Volgende stap

1. PR van `proxy` reviewen en mergen.
2. Cloudflare instellen (zie README → Deploy), geheimen invullen, app op de telefoon installeren en de toegangscode testen.
3. Op elke computer: `.dev.vars` aanmaken vanuit `.dev.vars.example` met echte sleutels.
4. Stap 3: LLM-interpretatie met tools, eerst met tekstinvoer.

## Open vragen / losse eindjes

- Biedt de importpagina van waarneming.nl (alleen ingelogd) andere formaten dan eBird-CSV?
- Branch `onderzoek-waarneming-nl` is gemerged en kan op GitHub weg.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen (`.dev.vars`, `.env`) staan niet in git; per computer zelf aanmaken.
