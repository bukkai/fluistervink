# Draaiboek: als het misgaat in stable

26 nov 2026, vóór de productierelease in Play. Wat te doen als `fluistervink.nl` (en dus de stabiele app, die zijn webcode live van dat adres laadt) stuk is na een release of hotfix, of als de proxy voor iedereen stilvalt. Eén keer geoefend op de beta voordat het echt nodig is (zie Oefenen, onderaan).

## Eerst: wat is er stuk?

| Wat je ziet | Waar het zit | Ga naar |
| --- | --- | --- |
| Na een release of hotfix werkt de app niet meer, of doet hij iets verkeerd | webcode of proxy in de laatste deploy van `fluistervink-stable` | A, daarna B |
| Uitspraken van iedereen blijven wachten; een bericht in Discord over het dagbudget | plafond voor alle installaties samen (`worker/guard.ts`) | C |
| Bericht in Discord: OpenAI of Anthropic weigert de sleutel, of het tegoed is op | sleutel of tegoed bij de aanbieder | D |
| De kosten lopen hard op, misbruik | proxy | noodrem (C) |
| Alleen de Android-app zelf (native, na een nieuwe app-versie) | AAB in Play | E |

De berichten in Discord komen van de proxy (`worker/alert.ts`, één per dag per soort, zie `docs/proxy.md`). Ook zonder bericht: Workers Logs van `fluistervink-stable` in het Cloudflare-dashboard.

## A. De vorige versie terugzetten (minuten)

Een versie van de Worker bevat de proxy én de bestanden van de app. Terugzetten zet dus beide terug, zonder te bouwen.

**Eerst nagaan (belangrijk):** heeft de release die je terugdraait een nieuwe `db.version(n)` in `src/lib/db.ts`? Dan niet terugzetten. Oude code kan een database met een hoger versienummer niet openen, en wie de nieuwe versie al opende, zit dan met een app die niet start. Repareer dan vooruit (B), eventueel met de noodrem erbij (C).

```bash
git diff <vorige-release>..origin/stable -- src/lib/db.ts | grep "db.version("
```

In het dashboard: **Workers & Pages → fluistervink-stable → Deployments**. Bij de versie van vóór de release: **⋯ → Rollback**, met een korte reden.

Of in de terminal (met dezelfde Cloudflare-login als `wrangler secret put`):

```bash
npx wrangler deployments list --name fluistervink-stable
```

```bash
npx wrangler rollback <version-id> --name fluistervink-stable --message "terug naar vóór de release van <datum>"
```

Nagaan: `https://fluistervink.nl/app/` in een privévenster openen en bij **Wat is er nieuw** de versie onderaan bekijken; een korte proefopname met de code van de eigenaar.

**Wanneer gebruikers het krijgen:** een nieuwe (ook een oudere) versie komt alleen bij het opstarten binnen, en wacht tot er geen sessie loopt (`src/lib/update.ts`). Wie de app open heeft, krijgt hem pas na helemaal afsluiten en opnieuw openen. De proxy is meteen terug.

## B. Repareren op `stable`

Na A staat de kapotte code nog op de branch `stable`. De volgende merge naar `stable` deployt alles weer, dus repareer eerst daar.

- **Alleen die release terugdraaien:** de gewone hotfix-weg uit `docs/omgevingen.md`. Een branch vanaf `origin/stable` met `git revert` van de merge (`git revert -m 1 <merge-commit>`), PR naar `stable`, daarna de PR van `stable` naar `main` met een merge commit.
- **Een fix vooruit:** net zo, met de fix in plaats van de revert. Staat dezelfde fout ook op `main`, dan ook daar (die PR van `stable` naar `main` neemt hem mee).

Workers Builds deployt `stable` na de merge; dat vervangt de teruggezette versie van A.

## C. Dagbudget of noodrem

- **Dagbudget bereikt** (`budget` in Discord): de uitspraken van iedereen behalve de eigenaar wachten tot middernacht (Nederlandse tijd) en gaan dan vanzelf door. Er gaat niets verloren. Is het echt gebruik en wil je niet wachten: verhoog het plafond voor beide omgevingen.

  ```bash
  npx wrangler secret put DAILY_BUDGET_USD
  ```

  ```bash
  npx wrangler secret put DAILY_BUDGET_USD --env stable
  ```

  (Een geheim in plaats van een var, zodat het zonder deploy werkt. Kijk eerst op Developer, Kosten, of het verbruik klopt met het aantal gebruikers.)
- **Misbruik:** zet de **noodrem** op Developer aan. Binnen een halve minuut stopt alles wat geld kost voor iedereen behalve de eigenaar. Daarna op Developer, Installaties, de installatie die het veroorzaakt **afsluiten**.

## D. Sleutel of tegoed bij OpenAI of Anthropic

Spraakherkenning of model werkt voor niemand; de uitspraken wachten.

- **Tegoed op:** opwaarderen bij de aanbieder (OpenAI: Billing; Anthropic: Console, Billing), en daar het automatisch bijvullen nalopen. De wachtrij gaat vanzelf weer door.
- **Sleutel geweigerd:** een nieuwe sleutel maken en in beide omgevingen zetten:

  ```bash
  npx wrangler secret put OPENAI_API_KEY
  ```

  ```bash
  npx wrangler secret put OPENAI_API_KEY --env stable
  ```

  (Net zo voor `ANTHROPIC_API_KEY`.) Ook in `.dev.vars` en de wachtwoordbeheerder.

## E. De Android-app zelf

Alleen bij een fout in de native code (`android/`), na een nieuwe app-versie. Webwijzigingen gaan via A en B.

- Een AAB in Play is niet terug te zetten. Upload een nieuwe build met een hoger versienummer (een nieuwe tag `v0.*`, `docs/google-play.md`), gebouwd van de commit van de vorige goede versie met de fix erop.
- **In productie:** rol een nieuwe app-versie gefaseerd uit (bv. eerst 20%). Dan kan **Uitrol stoppen** in de Play Console nog voordat iedereen hem heeft.

## Oefenen op de beta

Eén keer, zodat het draaiboek klopt voordat het nodig is. Gebruik een release zonder nieuwe `db.version(n)`.

1. `npx wrangler deployments list`: noteer de bovenste (huidige) en de vorige versie.
2. `npx wrangler rollback <vorige> --message "oefening"`. Open de beta in een privévenster en kijk naar de versie bij Wat is er nieuw.
3. Terug naar de huidige: `npx wrangler rollback <huidige> --message "oefening klaar"`.
4. Stuur een proefbericht naar de webhook (zie `docs/proxy.md`, Waarschuwingen) en kijk of het in Discord aankomt.
5. Pas dit draaiboek aan waar het niet klopte, en zet hier de datum van de oefening neer.

Geoefend: nog niet.
