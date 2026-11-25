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

Of in de terminal (met dezelfde Cloudflare-login als `wrangler secret put`). De lijst heeft de **nieuwste onderaan**; elke versie zonder `Message` is een build van Workers Builds (die zegt niet welke commit), en een "Secret Change" is ook een versie.

```bash
npx wrangler deployments list --name fluistervink-stable
```

```bash
npx wrangler rollback <version-id> --name fluistervink-stable --message "terug naar vóór de release van <datum>"
```

Het werkt binnen seconden (geoefend 25 nov). Nagaan welke webcode er staat, zonder browsercache, aan de naam van het JS-bestand (die verandert bij elke build):

```bash
curl -s "https://fluistervink.nl/app/?r=$RANDOM" | grep -o '/assets/app-[^"]*\.js'
```

Daarna `npx wrangler secret list --name fluistervink-stable`: staan alle geheimen er nog? Een geheim dat ná de teruggezette versie is gezet, eerst nalopen. En een korte proefopname met de code van de eigenaar.

**Let op:** loopt er nog een build in Workers Builds (net gemerged), dan zet die zijn versie gewoon over jouw teruggezette heen. Wacht tot hij klaar is (Cloudflare-dashboard, Builds), of zet hem stop, voordat je terugzet.

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

Doe het niet vlak na een merge naar `main`: Workers Builds moet klaar zijn.

1. `npx wrangler deployments list --name fluistervink`: de onderste is de huidige, die erboven de vorige. Noteer ook de naam van het JS-bestand (de `curl` uit A, met het adres van de beta).
2. `npx wrangler rollback <vorige> --name fluistervink --message "oefening"`. De naam van het JS-bestand moet veranderen; `secret list` moet nog alles geven.
3. Terug: **vraag de lijst opnieuw op** en zet de onderste terug, niet de id van stap 1 (er kan intussen een build bij zijn gekomen). Het JS-bestand moet weer dat van stap 1 zijn.
4. Stuur een proefbericht naar de webhook (zie `docs/proxy.md`, Waarschuwingen) en kijk of het in Discord aankomt.
5. Pas dit draaiboek aan waar het niet klopte, en zet hier de datum van de oefening neer.

Geoefend: 25 nov 2026 op de beta. Terugzetten werkte binnen seconden, de proxy bleef antwoorden en alle geheimen bleven staan. Geleerd: tijdens de oefening rolde Workers Builds nog drie merges uit (#395–#398). Daardoor was de id van "de huidige" al verouderd, en zette "terug" even een oudere build neer, tot de volgende build het rechtzette. Daarom stap 3 en de waarschuwing in A. Verder stond in de eerste versie van dit draaiboek dat de nieuwste bovenaan staat; dat is onderaan. Het proefbericht naar Discord kwam aan.
