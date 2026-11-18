# Twee omgevingen: beta en stabiel

Besloten 24 okt. Testers proberen nieuwe versies uit op de **beta**; wie gewoon wil vogelen, gebruikt de **stabiele** versie op `fluistervink.nl` en de app uit de Play Store.

| | Beta | Stabiel |
| --- | --- | --- |
| Adres | `fluistervink.stephanmullernl.workers.dev` | `fluistervink.nl` |
| Branch | `main` (elke gemergde PR) | `stable` (alleen als je hem bijwerkt) |
| Worker | `fluistervink` | `fluistervink-stable` (`env.stable` in `wrangler.jsonc`) |
| Bouwen | `npm run build` | `npm run build:stable` |
| In de app | label "beta" in de kop, heet "Fluistervink Beta" | heet "Fluistervink" |
| Google Play | interne test | gesloten test, later productie |

**Gedeeld:** de KV (`FEEDBACK`, `TESTERS`) en dezelfde geheimen. De code van de eigenaar werkt op beide adressen, en `npm run feedback -- pull` haalt alles op, waar het ook vandaan komt. Elke gedeelde sessie en elke JSON-export heeft een veld `channel` (`beta` of `stable`).

**Gescheiden:** de gegevens op de telefoon. IndexedDB hoort bij een adres, dus sessies op de beta zie je niet op `fluistervink.nl` en andersom. Overstappen gaat met de JSON-export en -import (Instellingen / Developer).

## Een nieuwe stabiele versie

Alles gaat eerst via `main` en de beta. Is de beta een tijdje goed bevallen:

```bash
npm run release
```

Dat laat zien welke commits meegaan en wanneer de laatste kwaliteitsronde was, vraagt of je door wilt, en zet dan `stable` gelijk aan `origin/main` (alleen vooruit; heeft `stable` een hotfix die nog niet op `main` staat, dan weigert het, zie hieronder). Workers Builds deployt daarna `fluistervink.nl`. Na de release is het tijd voor een kwaliteitsronde op de beta (`docs/kwaliteitsronde.md`).

## Nieuwe functies en fixes terwijl testers op stabiel zitten

Besloten 17 nov, bij de proef van twee weken met 12 testers op de gesloten test.

**Nieuwe functies** gaan gewoon naar `main`, het liefst achter een ontwikkeloptie (`src/lib/devOptions.ts`). Dan kan `main` op elk moment naar `stable` zonder dat testers iets nieuws zien, en gaat een fix de gewone weg: PR naar `main`, daarna `npm run release`. Een wijziging in de prompt of de tools geldt meteen voor iedereen; zet die ook achter een optie, of laat de PR liggen tot je hem naar stabiel wilt.

**Hotfix**, alleen als `main` al iets heeft dat nog niet naar de testers mag:

1. Branch vanaf `origin/stable` (`git switch -c fix-iets origin/stable`), de fix erop, PR naar **`stable`** (de checks draaien bij elke PR). Na de merge deployt Workers Builds `fluistervink.nl`.
2. Daarna meteen een PR van `stable` naar `main`, gemerged met **"Create a merge commit"** (niet squash of rebase: dan staan de commits van `stable` niet op `main` en weigert `npm run release` de volgende keer).

Is stap 2 vergeten, dan zegt `npm run release` dat en welke commits het zijn.

**Android:** een tag `v0.*` bouwt de beta- én de stabiele AAB van dezelfde commit. Staat er native code op `main` die nog niet naar de testers mag, upload dan alleen de beta-AAB naar de interne test en laat de gesloten test staan. Een toestemming waarvoor Google een verklaring wil (zoals de microfoon in de service), haalt de stabiele build zelf uit het manifest (`android/app/src/stable/AndroidManifest.xml`): dan kunnen beide AAB's gewoon mee. Webwijzigingen hebben hier geen last van: de stabiele app laadt live van `fluistervink.nl`.

De Android-app laadt de webcode van zijn adres, dus een nieuwe stabiele webversie staat meteen ook in de stabiele app. Alleen bij wijzigingen in `android/` een nieuwe app-versie, zie hieronder.

## Eenmalig, door de eigenaar

### 1. Domein naar Cloudflare

`fluistervink.nl` staat bij TransIP en heeft nog geen DNS-records (dus ook geen mail om over te zetten).

1. Cloudflare-dashboard → **Add a domain** → `fluistervink.nl`, plan **Free**. Records scannen mag, er zijn er geen.
2. Cloudflare toont twee nameservers (iets als `anna.ns.cloudflare.com`).
3. TransIP → Domeinen → `fluistervink.nl` → **Nameservers**: TransIP-instellingen uit, de twee van Cloudflare invullen. DNSSEC staat uit; laat dat zo tot Cloudflare het domein actief noemt (daarna kan het via Cloudflare aan).
4. Wachten tot Cloudflare mailt dat het domein actief is (minuten tot een paar uur).

### 2. Branch `stable`

```bash
npm run release
```

(De eerste keer maakt dit de branch aan.)

### 3. Tweede project in Workers Builds

Cloudflare-dashboard → **Workers & Pages → Create → Import a repository** → deze repository.

- Naam: `fluistervink-stable` (moet gelijk zijn aan `name` in `env.stable`).
- Build command: `npm run build:stable`
- Deploy command: `npx wrangler deploy` (zonder `--env`: de build heeft de stabiele configuratie al klaargezet).
- Production branch: `stable`. **Builds for non-production branches: uit** (previews draaien al op de beta).
- Build watch paths: zoals bij de beta, `*.md` en `docs/*` uitsluiten.

De eerste deploy koppelt ook het domein (`routes` in `wrangler.jsonc`): Cloudflare maakt het DNS-record en het certificaat zelf.

### 4. Geheimen

Dezelfde waarden als in de beta (staan in je wachtwoordbeheerder of `.dev.vars`):

```bash
npx wrangler secret put ACCESS_CODE --env stable
```

```bash
npx wrangler secret put OPENAI_API_KEY --env stable
```

```bash
npx wrangler secret put ANTHROPIC_API_KEY --env stable
```

Optioneel, voor de echte rekening op Developer (beheersleutels, zie `worker/billing.ts`):

```bash
npx wrangler secret put OPENAI_ADMIN_KEY --env stable
```

```bash
npx wrangler secret put ANTHROPIC_ADMIN_KEY --env stable
```

Daarna `https://fluistervink.nl` openen, bij Instellingen je code invullen en een korte proefopname doen.

### 5. Google Play

Zie `docs/google-play.md`. Kort: één app, twee tracks. De beta-AAB naar de **interne test** (de testers), de stabiele naar een **gesloten test**. Productie (openbaar in de Play Store) kan voor een nieuw persoonlijk account pas na 14 dagen gesloten test met minstens 12 testers, en is volgens de roadmap toch pas later aan de orde.

## Waar staat wie

- De eigenaar en de eerste tester blijven op de beta (workers.dev); hun gegevens staan daar.
- Nieuwe mensen die alleen willen vogelen: de stabiele versie (`fluistervink.nl`, of de gesloten test in Play). Een code is niet nodig.
- Testers van de beta: workers.dev, of de interne test in Play.
