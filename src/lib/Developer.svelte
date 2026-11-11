<script lang="ts">
  // Alleen voor de eigenaar (menu en route in App.svelte): feedback van testers
  // lezen, installaties bekijken en afsluiten, kosten bekijken, exporteren voor
  // de testset en importeren. Afgeschermd in de interface; de proxy staat het
  // beheer ook alleen de eigenaar toe.
  import {
    fetchBilling,
    hideTester,
    listSharedNotes,
    listTesters,
    listUsage,
    markNotesProcessed,
    removeTester,
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
    type WalkCost,
  } from './costs';
  import { db } from './db';
  import { ACTIVE_DAYS, lastSeen, splitActive } from './testers';
  import { describeImport, exportAllJson, importJson, saveFile } from './export';

  let testers = $state<Tester[]>();
  let testersError = $state('');
  /** Actief bovenaan; wie al een tijd niets deed of afgesloten is achter "Toon meer" */
  const split = $derived(splitActive(testers ?? []));
  let showInactive = $state(false);

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

  const noteDateFormat = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Verbruik zoals de proxy het telt (worker/usage.ts), in dollars met de
  // prijstabel in costs.ts. Vanaf het begin van de vorige maand.
  let costs = $state<CostSummary>();
  let usageRows = $state<UsageRow[]>([]);
  let costsError = $state('');
  // De echte rekening (worker/billing.ts), als controle op de prijstabel
  let billing = $state<Billing>();
  let billingError = $state('');
  /** Namen van eigen sessies; die van testers staan niet op dit apparaat */
  let walkNames = $state<Record<string, string>>({});

  async function loadCosts() {
    try {
      usageRows = await listUsage(startOfLastMonth(new Date()));
      costs = summarize(usageRows);
      costsError = '';
      const sessions = await db.sessions.bulkGet(costs.topWalks.map((w) => w.session));
      walkNames = Object.fromEntries(
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
      ? `${text} · stand van ${timeFormat.format(new Date(bill.fetchedAt))} (${bill.stale})`
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
  function walkMeta(walk: WalkCost): string {
    return [
      walkNames[walk.session] ? who(walk.tester) : undefined,
      dateFormat.format(new Date(walk.day)),
      walk.utterances ? count(walk.utterances, 'uitspraak', 'uitspraken') : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const maxTesterCost = $derived(Math.max(...(costs?.perTester.map((t) => t.cost) ?? []), 0));

  async function remove(tester: Tester) {
    if (!confirm(`${who(tester.name)} afsluiten? De app werkt daarna niet meer.`)) return;
    try {
      await removeTester(tester.name);
      await loadTesters();
    } catch (error) {
      testersError = `Afsluiten mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  async function hide(tester: Tester) {
    if (!confirm(`${who(tester.name)} uit de lijst halen? Hij blijft afgesloten.`)) return;
    try {
      await hideTester(tester.name);
      await loadTesters();
    } catch (error) {
      testersError = `Verwijderen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
  const timeFormat = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  /** "3 sessies · 41 uitspraken · 2× feedback · laatst 20 okt" */
  function usageText(tester: Tester): string {
    const { usage, lastUsed } = tester;
    const last = lastUsed || usage?.lastActivity ? lastSeen(tester) : undefined;
    return [
      usage
        ? [
            count(usage.walks, 'sessie', 'sessies'),
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
  <div class="card-head"><h2>Feedback van testers</h2></div>
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
                  {who(note.tester)} · {noteDateFormat.format(note.recordedAt)}{note.sessionName
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
              )}>Alles verwerkt</button
          >
        {/if}
        {#if processedCount > 0}
          <button class="link" onclick={() => (showProcessed = !showProcessed)}>
            {showProcessed ? 'Verwerkte verbergen' : `Verwerkte tonen (${processedCount})`}
          </button>
        {/if}
      </div>
    {:else if !notesError}
      <p class="hint">Bezig met ophalen…</p>
    {/if}
    <p class="hint">
      Feedback komt binnen zodra de app van een tester deelt, na het stoppen van een sessie.
      Verwerkt verbergt hem alleen; de gedeelde sessies blijven bewaard.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Installaties</h2></div>
  <div class="card-body stack">
    {#if testersError}
      <p class="message error">{testersError}</p>
    {/if}
    {#if testers?.length === 0}
      <p class="hint">Nog geen installaties.</p>
    {:else if testers}
      {#if split.active.length === 0}
        <p class="hint">Niemand actief in de laatste {ACTIVE_DAYS} dagen.</p>
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
              </span>
              <span class="usage muted">{usageText(tester)}</span>
            </span>
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
          Onder "Toon meer": afgesloten, of meer dan {ACTIVE_DAYS} dagen niet gebruikt.
        </p>
      {/if}
    {/if}
  </div>
</section>

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
        Deze maand: OpenAI {money(costs.openai)} · Anthropic {money(
          costs.anthropic,
        )}{costs.perUtterance !== undefined
          ? ` · ${money(costs.perUtterance)} per uitspraak`
          : ''}{costs.perWalk !== undefined ? ` · ${money(costs.perWalk)} per sessie` : ''}
      </p>
      {#if costs.perTester.length}
        <h3>Per tester, deze maand</h3>
        <ul class="bars">
          {#each costs.perTester as tester (tester.tester)}
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
      {/if}
      {#if costs.topWalks.length}
        <h3>Duurste sessies</h3>
        <ul class="walks">
          {#each costs.topWalks as walk (`${walk.tester}/${walk.session}`)}
            <li>
              <span>
                {walkNames[walk.session] ?? who(walk.tester)}
                <span class="muted">· {walkMeta(walk)}</span>
              </span>
              <span>{money(walk.cost)}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <h3>Rekening, deze maand</h3>
      {#if billingError}
        <p class="message error">{billingError}</p>
      {:else if billing}
        <ul class="walks">
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
      {#if costs.unknownModels.length}
        <p class="message error">
          Geen prijs voor {costs.unknownModels.join(', ')}; die tellen niet mee. Vul de prijstabel
          aan in src/lib/costs.ts.
        </p>
      {/if}
    {:else if !costsError}
      <p class="hint">Bezig met ophalen…</p>
    {/if}
    <p class="hint">
      Geteld door de proxy sinds 24 oktober 2026, voor alle testers en beide omgevingen; de testset
      telt mee bij de eigenaar, zonder sessie. In dollars, met de prijzen van 24 oktober 2026. De
      rekening is wat OpenAI en Anthropic in rekening brengen voor het project of de workspace van
      Fluistervink (zonder die instelling de hele organisatie), per dag in UTC en hooguit een uur
      oud; vergeleken vanaf de eerste getelde dag van de maand. Wijkt die flink af, kijk dan de
      prijstabel in src/lib/costs.ts na.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Gegevens</h2></div>
  <div class="card-body stack">
    <label class="check">
      <input type="checkbox" bind:checked={withAudio} />
      Met opnames (groter bestand; nodig voor de testset)
    </label>
    <button class="btn secondary block" onclick={exportData}>Alle gegevens exporteren (JSON)</button
    >
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
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
  }

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

  .error {
    color: var(--red);
  }

  h3 {
    margin: 0.25rem 0 0;
    font-size: 0.95rem;
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
  .walks {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }

  .bar-label,
  .walks li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .bar-label .muted {
    font-size: 0.85rem;
  }

  .walks .muted {
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

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
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

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
