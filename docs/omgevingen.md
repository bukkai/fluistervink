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

**Gedeeld:** de KV (`FEEDBACK`, `TESTERS`) en dezelfde geheimen. Eén toegangscode werkt op beide adressen, `npm run tester` zet de codes in beide Workers, en `npm run feedback -- pull` haalt alles op, waar het ook vandaan komt. Elke gedeelde wandeling en elke JSON-export heeft een veld `channel` (`beta` of `stable`).

**Gescheiden:** de gegevens op de telefoon. IndexedDB hoort bij een adres, dus wandelingen op de beta zie je niet op `fluistervink.nl` en andersom. Overstappen gaat met de JSON-export en -import (Instellingen / Developer).

## Een nieuwe stabiele versie

Alles gaat eerst via `main` en de beta. Is de beta een tijdje goed bevallen:

```bash
npm run release
```

Dat zet `stable` gelijk aan `origin/main` (alleen vooruit; is `stable` ooit apart veranderd, dan weigert git). Workers Builds deployt daarna `fluistervink.nl`. Een fix voor de stabiele versie gaat dus ook via een PR naar `main`, en daarna `npm run release`.

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

```bash
npm run tester -- push
```

(De laatste zet `ACCESS_CODES` in beta, previews en stabiel.) Daarna `https://fluistervink.nl/#code=<jouw code>` openen en een korte proefopname doen.

### 5. Google Play

Zie `docs/google-play.md`. Kort: één app, twee tracks. De beta-AAB naar de **interne test** (de testers), de stabiele naar een **gesloten test**. Productie (openbaar in de Play Store) kan voor een nieuw persoonlijk account pas na 14 dagen gesloten test met minstens 12 testers, en is volgens de roadmap toch pas later aan de orde.

## Waar staat wie

- De eigenaar en Maarten blijven op de beta (workers.dev); hun gegevens staan daar.
- Nieuwe mensen die alleen willen vogelen: uitnodigen vanaf het scherm Developer **op `fluistervink.nl`** (de link gebruikt het adres waarop je het scherm opent).
- Uitnodigingen voor de beta: vanaf het scherm Developer op workers.dev, zoals nu.
