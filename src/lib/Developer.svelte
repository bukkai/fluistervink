<script lang="ts">
  import { dateTimeFormat } from './format';
  // Alleen voor de eigenaar (menu en route in App.svelte): feedback van testers
  // lezen, installaties bekijken en afsluiten, kosten bekijken, exporteren voor
  // de testset en importeren. Afgeschermd in de interface; de proxy staat het
  // beheer ook alleen de eigenaar toe.
  import {
    deleteNotes,
    fetchBilling,
    hideTester,
    listSharedNotes,
    listTesters,
    markOwnInstall,
    listUsage,
    markNotesProcessed,
    removeTester,
    cleanupTesters,
    type SharedNote,
    type Tester,
  } from './api';
  import {
    checkBill,
    startOfLastMonth,
    summarize,
    type Billing,
    type CostSummary,
    type Provider,
    type UsageRow,
    type SessionCost,
  } from './costs';
  import { db } from './db';
  import {
    COST_PER_USER_HIGH,
    COST_PER_USER_OK,
    costPerKind,
    costPerUserWeek,
    costSplit,
    limitPeaks,
    MONTH_BUDGET,
    monthForecast,
    topShare,
    unitCostPerWeek,
    utterancesPerLanguage,
    versionsInUse,
  } from './stats';
  import { AUDIO_SECONDS_PER_DAY, MESSAGES_PER_DAY } from './limits';
  import { ACTIVE_DAYS, asOwner, lastSeen, ownInstalls, splitActive } from './testers';
  import { isUnused } from './unusedInstalls';
  import { describeImport, exportAllJson, importJson, saveFile } from './export';

  let testers = $state<Tester[]>();
  let testersError = $state('');
  /** Actief bovenaan; wie al een tijd niets deed of afgesloten is achter "Toon meer" */
  const split = $derived(splitActive(testers ?? []));
  let showInactive = $state(false);
  /** Kosten: de duurste testers, de rest achter "Alle testers" */
  const TOP_TESTERS = 3;
  let showAllTesters = $state(false);

  async function loadTesters() {
    try {
      testers = await listTesters();
      testersError = '';
    } catch (error) {
      testersError = `Testers ophalen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }
  loadTesters();

  /** "Anna (app-3f9a2b1c)" als een installatie een eigen naam opgaf, anders de naam zelf */
  const displayNames = $derived(
    new Map((testers ?? []).filter((t) => t.displayName).map((t) => [t.name, t.displayName!])),
  );
  function who(name: string): string {
    const display = displayNames.get(name);
    return display ? `${display} (${name})` : name;
  }

  // Feedback van alle testers, zoals de proxy hem heeft. Komt pas binnen als de
  // app van de tester deelt (na het stoppen van een sessie). Verwerkt = in
  // een ontwikkelsessie bekeken; de gegevens zelf blijven staan (testset).
  let notes = $state<SharedNote[]>();
  let notesError = $state('');
  let showProcessed = $state(false);
  const newNotes = $derived(notes?.filter((n) => !n.processed) ?? []);
  const processedCount = $derived((notes?.length ?? 0) - newNotes.length);
  const shownNotes = $derived(showProcessed ? (notes ?? []) : newNotes);

  async function loadNotes() {
    try {
      notes = await listSharedNotes();
      notesError = '';
    } catch (error) {
      notesError = `Feedback ophalen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }
  loadNotes();

  async function setProcessed(ids: string[], processed: boolean) {
    try {
      await markNotesProcessed(ids, processed);
      const changed = new Set(ids);
      notes = notes?.map((n) => (changed.has(n.id) ? { ...n, processed } : n));
    } catch (error) {
      notesError = `Opslaan mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  /** Verwerkte feedback voorgoed van de lijst; de gedeelde sessies blijven (testset) */
  async function deleteProcessed() {
    const ids = (notes ?? []).filter((n) => n.processed).map((n) => n.id);
    if (!confirm(`${ids.length}× verwerkte feedback wissen?`)) return;
    try {
      await deleteNotes(ids);
      const gone = new Set(ids);
      notes = notes?.filter((n) => !gone.has(n.id));
      showProcessed = false;
    } catch (error) {
      notesError = `Wissen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  // Verbruik zoals de proxy het telt (worker/usage.ts), in dollars met de
  // prijstabel in costs.ts. Vanaf het begin van de vorige maand.
  let rawUsage = $state<UsageRow[]>();
  // Installaties van de eigenaar zelf tellen als de eigenaar (testers.ts)
  const usageRows = $derived(asOwner(rawUsage ?? [], ownInstalls(testers ?? [])));
  const costs = $derived<CostSummary | undefined>(rawUsage && summarize(usageRows));
  let costsError = $state('');
  // De echte rekening (worker/billing.ts), als controle op de prijstabel
  let billing = $state<Billing>();
  let billingError = $state('');
  /** Namen van eigen sessies; die van testers staan niet op dit apparaat */
  let sessionNames = $state<Record<string, string>>({});

  async function loadCosts() {
    try {
      rawUsage = await listUsage(startOfLastMonth(new Date()));
      costsError = '';
      const top = summarize(rawUsage).topSessions;
      const sessions = await db.sessions.bulkGet(top.map((w) => w.session));
      sessionNames = Object.fromEntries(
        sessions.flatMap((session) => (session?.place ? [[session.id, session.place.name]] : [])),
      );
    } catch (error) {
      costsError = `Kosten ophalen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }
  loadCosts();

  async function loadBilling() {
    try {
      billing = await fetchBilling();
    } catch (error) {
      billingError = `Rekening ophalen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }
  loadBilling();

  const providers: { id: Provider; name: string }[] = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
  ];
  /** "geteld $1,20 · rekening $1,32 (+10%) vanaf 24 okt", of waarom er geen rekening is */
  function billText(provider: Provider): string {
    const bill = billing?.[provider];
    if (bill === undefined) return '';
    if (bill === null) return 'geen beheersleutel ingesteld';
    if ('error' in bill) return bill.error;
    const check = checkBill(usageRows, bill, provider);
    const diff = check.counted
      ? ` (${check.billed >= check.counted ? '+' : '−'}${Math.round((Math.abs(check.billed - check.counted) / check.counted) * 100)}%)`
      : '';
    const text = `geteld ${money(check.counted)} · rekening ${money(check.billed)}${diff} vanaf ${dateFormat.format(new Date(check.since))}`;
    // Opnieuw ophalen mislukte: de laatst bekende rekening, met de fout erbij
    return bill.stale
      ? `${text} · stand van ${dateTimeFormat.format(new Date(bill.fetchedAt))} (${bill.stale})`
      : text;
  }

  const centsFormat = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
  });
  // Een uitspraak kost een fractie van een cent
  const smallFormat = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumSignificantDigits: 2,
  });
  const money = (amount: number) =>
    (amount > 0 && amount < 0.01 ? smallFormat : centsFormat).format(amount);
  /** "anna · 24 okt · 42 uitspraken" (de tester alleen als de naam van de sessie ervoor staat) */
  function sessionMeta(entry: SessionCost): string {
    return [
      sessionNames[entry.session] ? who(entry.tester) : undefined,
      dateFormat.format(new Date(entry.day)),
      entry.utterances ? count(entry.utterances, 'uitspraak', 'uitspraken') : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  // Kosten per actieve gebruiker per week, voor de betaalde laag
  // (docs/roadmap.md, punt 6). Lege weken vóór het eerste gebruik weg.
  const userWeeks = $derived.by(() => {
    const weeks = costPerUserWeek(usageRows, startOfLastMonth(new Date()));
    const last = weeks.findLastIndex((w) => w.users > 0);
    return weeks.slice(0, last + 1);
  });
  /** Gemiddeld per actieve gebruiker over de hele weken, en omgerekend per maand */
  const perUserAverage = $derived.by(() => {
    const full = userWeeks.filter((w) => !w.current && w.users > 0);
    const users = full.reduce((sum, w) => sum + w.users, 0);
    if (!users) return undefined;
    const week = full.reduce((sum, w) => sum + w.cost, 0) / users;
    return { week, month: (week * 52) / 12, weeks: full.length };
  });
  // Kostengrens per stap (docs/plan-marketing.md): wat het gemiddelde per
  // maand betekent voor de volgende stap
  const costVerdict = $derived.by(() => {
    if (!perUserAverage) return undefined;
    const month = perUserAverage.month;
    if (month < COST_PER_USER_OK) return 'onder de grens: de volgende stap mag';
    if (month < COST_PER_USER_HIGH) return 'tussen de grenzen: de betaalde laag gaat voor';
    return 'boven de grens: eerst de kosten omlaag of de betaalde laag';
  });
  const forecast = $derived(costs ? monthForecast(costs.thisMonth) : undefined);
  /** Alleen gebruikers: wat de app kost zonder jouw testen */
  const usersForecast = $derived(costs ? monthForecast(costs.split.users) : undefined);
  const concentration = $derived(topShare(usageRows));
  const costParts = $derived(
    costSplit(usageRows, new Map((testers ?? []).flatMap((t) => (t.via ? [[t.name, t.via]] : [])))),
  );
  const splitText = (parts: Record<string, number>, names: Record<string, string>) =>
    Object.entries(parts)
      .sort(([, a], [, b]) => b - a)
      .map(([key, cost]) => `${names[key] ?? key} ${money(cost)}`)
      .join(' · ');
  const unitWeeks = $derived(unitCostPerWeek(usageRows, startOfLastMonth(new Date())));
  const peaks = $derived(limitPeaks(usageRows));
  // Stap 2: per functie, versie en taal (labels die de app sinds 23 nov meestuurt)
  const kinds = $derived(costPerKind(usageRows));
  const KIND_NAMES: Record<string, string> = {
    knop: 'Knop',
    trektel: 'Trektelling',
    tuintelling: 'Tuintelling',
    proberen: 'Probeer het eens',
    '': 'Onbekend',
  };
  const versions = $derived(versionsInUse(usageRows));
  const languages = $derived(utterancesPerLanguage(usageRows));
  const hours = (seconds: number) =>
    `${(seconds / 3600).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} u`;
  const maxTesterCost = $derived(Math.max(...(costs?.perTester.map((t) => t.cost) ?? []), 0));

  const unusedCount = $derived((testers ?? []).filter((t) => isUnused(t)).length);

  async function cleanup() {
    if (
      !confirm(
        `${unusedCount} installaties uit de lijst halen die nooit iets inspraken, deelden of een naam opgaven? Ze blijven werken en komen terug zodra ze iets doen.`,
      )
    )
      return;
    try {
      const gone = new Set(await cleanupTesters());
      testers = testers?.filter((t) => !gone.has(t.name));
    } catch (error) {
      testersError = `Opruimen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  // De lijst na een wijziging hier bijwerken, niet opnieuw ophalen: de proxy
  // leest hem uit KV, en die geeft tot een minuut een oude stand terug.
  function changeTester(name: string, change: Partial<Tester>) {
    testers = testers?.map((t) => (t.name === name ? { ...t, ...change } : t));
  }

  async function remove(tester: Tester) {
    if (!confirm(`${who(tester.name)} afsluiten? De app werkt daarna niet meer.`)) return;
    try {
      await removeTester(tester.name);
      changeTester(tester.name, { blocked: true });
    } catch (error) {
      testersError = `Afsluiten mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  async function toggleOwn(tester: Tester) {
    try {
      await markOwnInstall(tester.name, !tester.owner);
      changeTester(tester.name, { owner: !tester.owner || undefined });
    } catch (error) {
      testersError = `Aanpassen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  async function hide(tester: Tester) {
    if (!confirm(`${who(tester.name)} uit de lijst halen? Hij blijft afgesloten.`)) return;
    try {
      await hideTester(tester.name);
      testers = testers?.filter((t) => t.name !== tester.name);
    } catch (error) {
      testersError = `Verwijderen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  /** "3 sessies · 41 uitspraken · 2× feedback · laatst 20 okt" */
  function usageText(tester: Tester): string {
    const { usage, lastUsed } = tester;
    const last = lastUsed || usage?.lastActivity ? lastSeen(tester) : undefined;
    return [
      usage
        ? [
            count(usage.sessions, 'sessie', 'sessies'),
            count(usage.utterances, 'uitspraak', 'uitspraken'),
            `${usage.notes}× feedback`,
          ].join(' · ')
        : 'nog niets gedeeld',
      last ? `laatst ${dateFormat.format(last)}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  let importMessage = $state('');

  async function importData(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      importMessage = describeImport(await importJson(file));
    } catch (error) {
      importMessage = `Importeren mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  /** Met opnames: voor de testset, of om terug te kunnen luisteren na importeren */
  let withAudio = $state(false);

  let exportMessage = $state('');

  async function exportData() {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = withAudio ? '-met-opnames' : '';
    exportMessage = '';
    try {
      const saved = await saveFile(
        await exportAllJson({ withAudio }),
        `fluistervink-${date}${suffix}.json`,
      );
      if (saved && saved.folder) exportMessage = `Opgeslagen in ${saved.folder}.`;
    } catch (error) {
      exportMessage = `Exporteren mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }
</script>

<a class="back" href="#/">Terug</a>
<h2 class="page-title">Developer</h2>

<section class="card">
  <div class="card-head"><h2>Kosten</h2></div>
  <div class="card-body stack">
    {#if costsError}
      <p class="message error">{costsError}</p>
    {/if}
    {#if costs}
      <dl class="totals">
        <div>
          <dt>Vandaag</dt>
          <dd>{money(costs.today)}</dd>
        </div>
        <div>
          <dt>Deze maand</dt>
          <dd>{money(costs.thisMonth)}</dd>
        </div>
        <div>
          <dt>Vorige maand</dt>
          <dd>{money(costs.lastMonth)}</dd>
        </div>
      </dl>
      <p class="hint">
        Deze maand: gebruikers {money(costs.split.users)} · jouw sessies {money(costs.split.owner)} ·
        testset {money(costs.split.testset)}.
      </p>
      {#if costs.perTester.length}
        <h3>Duurste testers, deze maand</h3>
        <ul class="bars">
          {#each showAllTesters ? costs.perTester : costs.perTester.slice(0, TOP_TESTERS) as tester (tester.tester)}
            <li>
              <div class="bar-label">
                <span>{who(tester.tester)}</span>
                <span class="muted">
                  {money(tester.cost)}{tester.utterances
                    ? ` · ${count(tester.utterances, 'uitspraak', 'uitspraken')}`
                    : ''}
                </span>
              </div>
              <div class="bar">
                <span style:width={`${maxTesterCost ? (tester.cost / maxTesterCost) * 100 : 0}%`}
                ></span>
              </div>
            </li>
          {/each}
        </ul>
        {#if costs.perTester.length > TOP_TESTERS}
          <button class="link more" onclick={() => (showAllTesters = !showAllTesters)}>
            {showAllTesters ? 'Toon minder' : `Alle testers (${costs.perTester.length})`}
          </button>
        {/if}
      {/if}
      {#if userWeeks.length}
        <h3>Per actieve gebruiker, per week</h3>
        <div class="table">
          <table>
            <thead>
              <tr>
                <th scope="col">Week van</th>
                <th scope="col">Gebr.</th>
                <th scope="col">Gem.</th>
                <th scope="col">Mediaan</th>
                <th scope="col">Hoogste</th>
              </tr>
            </thead>
            <tbody>
              {#each userWeeks as w (w.week)}
                <tr>
                  <th scope="row">
                    {dateFormat.format(new Date(w.week))}{w.current ? ' (nu)' : ''}
                  </th>
                  <td>{w.users}</td>
                  <td>{w.users ? money(w.perUser) : '–'}</td>
                  <td>{w.users ? money(w.median) : '–'}</td>
                  <td>{w.users ? money(w.max) : '–'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="hint">
          {#if perUserAverage}
            Gemiddeld {money(perUserAverage.week)} per actieve gebruiker per week, ongeveer {money(
              perUserAverage.month,
            )} per maand (over {count(perUserAverage.weeks, 'hele week', 'hele weken')}).
          {/if}
          Actief: minstens één uitspraak in een sessie die week. Zonder de eigenaar en de testset; beide
          omgevingen.
        </p>
      {/if}
      {#if kinds.length}
        <h3>Per functie, deze maand</h3>
        <div class="table">
          <table>
            <thead>
              <tr>
                <th scope="col">Functie</th>
                <th scope="col">Uitspr.</th>
                <th scope="col">Kosten</th>
                <th scope="col">Per uitspr.</th>
              </tr>
            </thead>
            <tbody>
              {#each kinds as k (k.kind)}
                <tr>
                  <th scope="row">{KIND_NAMES[k.kind] ?? k.kind}</th>
                  <td>{k.utterances}</td>
                  <td>{money(k.cost)}</td>
                  <td>{k.perUtterance === undefined ? '–' : money(k.perUtterance)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="hint">
          Zonder de eigenaar en de testset. Onbekend: van vóór 23 november of een oudere versie van
          de app. Tuintelling telt ook met de knop ingesproken uitspraken.
        </p>
      {/if}
      <h3>Kostengrens</h3>
      <ul class="amounts">
        {#if perUserAverage}
          <li>
            <span>Per actieve gebruiker per maand</span>
            <span>{money(perUserAverage.month)}</span>
          </li>
        {/if}
        {#if forecast !== undefined}
          <li>
            <span>Deze maand naar verwachting</span>
            <span class:over={forecast > MONTH_BUDGET}>
              {money(forecast)} van {money(MONTH_BUDGET)}
            </span>
          </li>
        {/if}
        {#if usersForecast !== undefined}
          <li>
            <span class="muted">waarvan gebruikers</span>
            <span class="muted">{money(usersForecast)}</span>
          </li>
        {/if}
        {#if perUserAverage}
          {#each [100, 500, 1000] as users (users)}
            <li>
              <span class="muted">Bij {users} actieve gebruikers</span>
              <span class="muted">{money(perUserAverage.month * users)} per maand</span>
            </li>
          {/each}
        {/if}
      </ul>
      <p class="hint">
        {#if costVerdict}Gemiddeld {costVerdict}.{/if}
        Grenzen {money(COST_PER_USER_OK)} en {money(COST_PER_USER_HIGH)} per actieve gebruiker per maand,
        budget {money(MONTH_BUDGET)} (ongeveer €50) per maand tot de betaalde laag er is (docs/plan-marketing.md).
        De verwachting rekent deze maand door met alles, ook je eigen sessies en de testset (zoals de
        rekening); daaronder alleen gebruikers.
        {#if concentration}
          {concentration.top === 1
            ? 'De duurste gebruiker'
            : `De duurste ${concentration.top} gebruikers`} van de {concentration.users}
          {concentration.top === 1 ? 'maakte' : 'maakten'} deze maand {Math.round(
            concentration.share * 100,
          )}% van de kosten.
        {/if}
      </p>
      {#if costs.unknownModels.length}
        <p class="message error">
          Geen prijs voor {costs.unknownModels.join(', ')}; die tellen niet mee. Vul de prijstabel
          aan in src/lib/costs.ts.
        </p>
      {/if}
      <details class="more-details">
        <summary>Meer: per aanbieder, duurste sessies, rekening</summary>
        <div class="stack">
          <p class="hint">
            Deze maand: OpenAI {money(costs.openai)} · Anthropic {money(
              costs.anthropic,
            )}{costs.perUtterance !== undefined
              ? ` · ${money(costs.perUtterance)} per uitspraak`
              : ''}{costs.perSession !== undefined
              ? ` · ${money(costs.perSession)} per sessie`
              : ''}
          </p>
          <p class="hint">
            Deze maand per omgeving: {splitText(costParts.channel, {
              stable: 'stabiel',
              beta: 'beta',
            }) || '–'}. Per aanmelding: {splitText(costParts.via, {
              play: 'Android-app',
              turnstile: 'browser',
            }) || '–'}. Zonder de testset.
          </p>
          <p class="hint">
            Dicht bij het plafond, deze maand: hooguit {peaks.messages} van {MESSAGES_PER_DAY} verzoeken
            aan het model en {hours(peaks.audioSeconds)} van {hours(AUDIO_SECONDS_PER_DAY)} spraak door
            één installatie op één dag; {peaks.hits === 0
              ? 'niemand raakte een plafond'
              : `${peaks.hits}× een plafond geraakt`}. Zonder de eigenaar.
          </p>
          <p class="hint">
            Versies de laatste 7 dagen: {versions.length
              ? versions
                  .map(
                    (v) =>
                      `${v.version} (${count(v.installs, 'installatie', 'installaties')}, tot ${dateFormat.format(new Date(v.lastDay))})`,
                  )
                  .join(' · ')
              : '–'}. Uitspraken per taal deze maand: {Object.entries(languages)
              .map(([language, n]) => `${language || 'onbekend'} ${n}`)
              .join(' · ') || '–'}. Zonder de eigenaar en de testset.
          </p>
          {#if unitWeeks.length}
            <h3>Per uitspraak, per week</h3>
            <div class="table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Week van</th>
                    <th scope="col">Uitspr.</th>
                    <th scope="col">Per uitspr.</th>
                    <th scope="col">Cache</th>
                  </tr>
                </thead>
                <tbody>
                  {#each unitWeeks as w (w.week)}
                    <tr>
                      <th scope="row">{dateFormat.format(new Date(w.week))}</th>
                      <td>{w.utterances}</td>
                      <td>{w.perUtterance === undefined ? '–' : money(w.perUtterance)}</td>
                      <td>
                        {w.cacheShare === undefined ? '–' : `${Math.round(w.cacheShare * 100)}%`}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <p class="hint">
              Alle sessies, ook de eigenaar; zonder de testset. Cache: deel van de invoer aan het
              model dat uit de cache kwam. Springt de prijs per uitspraak omhoog na een nieuwe
              promptversie, kijk dan daar.
            </p>
          {/if}
          {#if costs.topSessions.length}
            <h3>Duurste sessies</h3>
            <ul class="amounts">
              {#each costs.topSessions as entry (`${entry.tester}/${entry.session}`)}
                <li>
                  <span>
                    {sessionNames[entry.session] ?? who(entry.tester)}
                    <span class="muted">· {sessionMeta(entry)}</span>
                  </span>
                  <span>{money(entry.cost)}</span>
                </li>
              {/each}
            </ul>
          {/if}
          <h3>Rekening, deze maand</h3>
          {#if billingError}
            <p class="message error">{billingError}</p>
          {:else if billing}
            <ul class="amounts">
              {#each providers as provider (provider.id)}
                <li>
                  <span>{provider.name}</span>
                  <span class="muted">{billText(provider.id)}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="hint">Bezig met ophalen…</p>
          {/if}
          <p class="hint">
            Geteld door de proxy sinds 24 oktober 2026, voor alle testers en beide omgevingen; de
            testset telt mee bij de eigenaar, zonder sessie. In dollars, met de prijzen van 24
            oktober 2026. De rekening is wat OpenAI en Anthropic in rekening brengen voor het
            project of de workspace van Fluistervink (zonder die instelling de hele organisatie),
            per dag in UTC en hooguit een uur oud; vergeleken vanaf de eerste getelde dag van de
            maand. Wijkt die flink af, kijk dan de prijstabel in src/lib/costs.ts na.
          </p>
        </div>
      </details>
    {:else if !costsError}
      <p class="hint">Bezig met ophalen…</p>
    {/if}
  </div>
</section>

<details class="card fold" open={newNotes.length > 0}>
  <summary class="card-head">
    <h2>Feedback van testers</h2>
    <span class="muted">
      {notes ? (newNotes.length ? `${newNotes.length} nieuw` : 'niets nieuws') : ''}
    </span>
  </summary>
  <div class="card-body stack">
    {#if notesError}
      <p class="message error">{notesError}</p>
    {/if}
    {#if notes}
      {#if shownNotes.length === 0}
        <p class="hint">Geen nieuwe feedback.</p>
      {:else}
        <ul class="notes">
          {#each shownNotes as note (note.id)}
            <li class:processed={note.processed}>
              <div class="note-meta muted">
                <span>
                  {who(note.tester)} · {dateTimeFormat.format(note.recordedAt)}{note.sessionName
                    ? ` · ${note.sessionName}`
                    : ''}
                </span>
                <button class="link" onclick={() => setProcessed([note.id], !note.processed)}>
                  {note.processed ? 'Terugzetten' : 'Verwerkt'}
                </button>
              </div>
              <p class="note-text">{note.text || '(leeg)'}</p>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="note-actions">
        {#if newNotes.length > 1}
          <button
            class="btn secondary"
            onclick={() =>
              setProcessed(
                newNotes.map((n) => n.id),
                true,
              )}
          >
            Alles verwerkt
          </button>
        {/if}
        {#if processedCount > 0}
          <button class="link" onclick={() => (showProcessed = !showProcessed)}>
            {showProcessed ? 'Verwerkte verbergen' : `Verwerkte tonen (${processedCount})`}
          </button>
          <button class="link danger" onclick={deleteProcessed}>Verwerkte wissen</button>
        {/if}
      </div>
    {:else if !notesError}
      <p class="hint">Bezig met ophalen…</p>
    {/if}
    <p class="hint">
      Feedback komt binnen zodra de app van een tester deelt, na het stoppen van een sessie.
      Verwerkt verbergt hem; Verwerkte wissen haalt hem voorgoed van de lijst. De gedeelde sessies
      zelf blijven bewaard, voor de testset.
    </p>
  </div>
</details>

<details class="card fold">
  <summary class="card-head">
    <h2>Installaties</h2>
    <span class="muted">
      {testers ? `${testers.length}, waarvan ${split.active.length} actief` : ''}
    </span>
  </summary>
  <div class="card-body stack">
    {#if testersError}
      <p class="message error">{testersError}</p>
    {/if}
    {#if testers?.length === 0}
      <p class="hint">Nog geen installaties.</p>
    {:else if testers}
      {#if split.active.length === 0}
        <p class="hint">Niemand die de laatste {ACTIVE_DAYS} dagen iets deelde.</p>
      {/if}
      <ul class="testers">
        {#each showInactive ? [...split.active, ...split.inactive] : split.active as tester (tester.name)}
          <li>
            <span class="name">
              {who(tester.name)}
              <span class="muted">
                {tester.invitedAt ? `· ${dateFormat.format(tester.invitedAt)}` : ''}
                · {tester.via === 'play' ? 'Play' : 'browser'}
                {tester.blocked ? '· afgesloten' : ''}
                {tester.owner ? '· van mij' : ''}
              </span>
              <span class="usage muted">{usageText(tester)}</span>
            </span>
            <button class="link" onclick={() => toggleOwn(tester)}>
              {tester.owner ? 'Niet van mij' : 'Van mij'}
            </button>
            {#if tester.blocked}
              <button class="link danger" onclick={() => hide(tester)}>Verwijderen</button>
            {:else}
              <button class="link danger" onclick={() => remove(tester)}>Afsluiten</button>
            {/if}
          </li>
        {/each}
      </ul>
      {#if split.inactive.length > 0}
        <button class="link more" onclick={() => (showInactive = !showInactive)}>
          {showInactive ? 'Toon minder' : `Toon meer (${split.inactive.length})`}
        </button>
        <p class="hint">
          Onder "Toon meer": afgesloten, van mij, nog niets gedeeld, of meer dan {ACTIVE_DAYS} dagen niet
          gebruikt.
        </p>
      {/if}
      {#if unusedCount > 0}
        <button class="link more" onclick={cleanup}>Ongebruikte opruimen ({unusedCount})</button>
        <p class="hint">
          Ongebruikt: aangemeld vóór vandaag en daarna niets ingesproken, gedeeld of een naam
          opgegeven.
        </p>
      {/if}
    {/if}
  </div>
</details>

<details class="card fold">
  <summary class="card-head">
    <h2>Gegevens</h2>
    <span class="muted">export en import</span>
  </summary>
  <div class="card-body stack">
    <label class="check">
      <input type="checkbox" bind:checked={withAudio} />
      Met opnames (groter bestand; nodig voor de testset)
    </label>
    <button class="btn secondary block" onclick={exportData}>
      Alle gegevens exporteren (JSON)
    </button>
    {#if exportMessage}
      <p class="message error">{exportMessage}</p>
    {/if}
    <label class="btn secondary block file">
      Sessies importeren (JSON)
      <input type="file" accept="application/json,.json" onchange={importData} />
    </label>
    {#if importMessage}
      <p class="message">{importMessage}</p>
    {/if}
    <p class="hint">
      Importeren leest een eerdere export weer in. Alleen sessies die er nog niet zijn; opnames
      alleen als ze in de export zitten.
    </p>
  </div>
</details>

<style>
  label:not(.check, .file) {
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
  }

  label input {
    font-weight: 400;
  }

  .testers {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }

  .testers li {
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }

  .testers .name {
    flex: 1;
    min-width: 0;
  }

  .testers .usage {
    display: block;
    font-size: 0.85rem;
  }

  h3 {
    margin: 0.25rem 0 0;
    font-size: 0.95rem;
  }

  .table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 0.35rem 0.2rem;
    text-align: right;
    border-bottom: 1px solid var(--border);
  }

  th:first-child {
    text-align: left;
    font-weight: 400;
    white-space: nowrap;
  }

  thead th {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
  }

  .totals {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .totals dt {
    font-size: 0.85rem;
    color: var(--muted);
  }

  .totals dd {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .bars,
  .amounts {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }

  .bar-label,
  .amounts li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .bar-label .muted {
    font-size: 0.85rem;
  }

  .amounts .over {
    color: var(--red);
    font-weight: 600;
  }

  .amounts .muted {
    font-size: 0.85rem;
  }

  .bar {
    margin-top: 0.2rem;
    height: 0.5rem;
    border-radius: 0.25rem;
    background: var(--border);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--brand);
  }

  .fold > summary {
    cursor: pointer;
    list-style: none;
  }

  .fold > summary::-webkit-details-marker {
    display: none;
  }

  .fold > summary h2::before {
    content: '▸ ';
    color: var(--muted);
  }

  .fold[open] > summary h2::before {
    content: '▾ ';
  }

  .fold:not([open]) > summary {
    border-bottom: none;
  }

  .more-details > summary {
    font-size: 0.9rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0.25rem 0;
  }

  .more-details > .stack {
    margin-top: 0.5rem;
  }

  .notes {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.75rem;
  }

  .notes li.processed {
    opacity: 0.6;
  }

  .note-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    font-size: 0.85rem;
  }

  .note-text {
    margin: 0.15rem 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .note-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .note-actions:empty {
    display: none;
  }

  .file {
    display: flex;
    font-size: 1rem;
    color: var(--fg);
  }

  .file input {
    display: none;
  }

  .message {
    margin: 0;
  }
</style>
