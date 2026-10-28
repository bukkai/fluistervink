<script lang="ts">
  // Alleen voor de eigenaar (menu en route in App.svelte): feedback van testers
  // lezen, testers uitnodigen, kosten bekijken, exporteren voor de testset en importeren. Afgeschermd in de interface; de
  // proxy staat het beheer van testers ook alleen de eigenaar toe.
  import {
    addTester,
    fetchBilling,
    inviteLink,
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
  import { exportAllJson, importJson, saveFile } from './export';
  import { inviteMail, inviteMailto, PLAY_TEST_LINKS } from './invite';
  import { CHANNEL } from './log';

  let testers = $state<Tester[]>();
  let testersError = $state('');

  async function loadTesters() {
    try {
      testers = await listTesters();
      testersError = '';
    } catch (error) {
      testersError = `Testers ophalen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }
  loadTesters();

  // Feedback van alle testers, zoals de proxy hem heeft. Komt pas binnen als de
  // app van de tester deelt (na het stoppen van een wandeling). Verwerkt = in
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
  /** Namen van eigen wandelingen; die van testers staan niet op dit apparaat */
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
    return `geteld ${money(check.counted)} · rekening ${money(check.billed)}${diff} vanaf ${dateFormat.format(new Date(check.since))}`;
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
  /** "anna · 24 okt · 42 uitspraken" (de tester alleen als de naam van de wandeling ervoor staat) */
  function walkMeta(walk: WalkCost): string {
    return [
      walkNames[walk.session] ? walk.tester : undefined,
      dateFormat.format(new Date(walk.day)),
      walk.utterances ? count(walk.utterances, 'uitspraak', 'uitspraken') : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const maxTesterCost = $derived(Math.max(...(costs?.perTester.map((t) => t.cost) ?? []), 0));

  let name = $state('');
  let email = $state('');
  let inviting = $state(false);
  /** Net uitgenodigd: knop naar de mail-app, en de link om te kopiëren */
  let invited = $state<{ name: string; link: string; mailto: string }>();
  let inviteError = $state('');

  /**
   * Maakt een code bij de proxy en toont daarna een knop die de mail-app opent
   * met een kant-en-klaar bericht. De mail gaat vanaf je eigen adres (geen
   * mailserver nodig, komt niet in de spam); het e-mailadres zelf wordt
   * nergens bewaard. De mail-app openen kan niet meteen na het aanmaken:
   * Chrome op Android opent een andere app alleen direct na een tik, en het
   * wachten op de proxy telt niet meer als zo'n tik.
   */
  async function invite(event: SubmitEvent) {
    event.preventDefault();
    inviting = true;
    inviteError = '';
    invited = undefined;
    try {
      const tester = await addTester(name.trim());
      const link = inviteLink(tester.code);
      invited = {
        name: tester.name,
        link,
        mailto: inviteMailto(
          email.trim(),
          inviteMail(tester.name, link, tester.code, PLAY_TEST_LINKS[CHANNEL]),
        ),
      };
      name = '';
      email = '';
      await loadTesters();
    } catch (error) {
      inviteError = `Uitnodigen mislukt: ${error instanceof Error ? error.message : error}`;
    } finally {
      inviting = false;
    }
  }

  let copied = $state('');

  async function copyLink(key: string, link: string) {
    await navigator.clipboard.writeText(link);
    copied = key;
    setTimeout(() => (copied = ''), 2000);
  }

  async function remove(tester: Tester) {
    const what = tester.source === 'install' ? 'De app' : 'De code';
    if (!confirm(`${tester.name} afsluiten? ${what} werkt daarna niet meer.`)) return;
    try {
      await removeTester(tester.name);
      if (invited?.name === tester.name) invited = undefined;
      await loadTesters();
    } catch (error) {
      testersError = `Afsluiten mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  /** "3 wandelingen · 41 uitspraken · 2× feedback · laatst 20 okt" */
  function usageText(usage: Tester['usage']): string {
    if (!usage) return 'nog niets gedeeld';
    return [
      count(usage.walks, 'wandeling', 'wandelingen'),
      count(usage.utterances, 'uitspraak', 'uitspraken'),
      `${usage.notes}× feedback`,
      usage.lastActivity ? `laatst ${dateFormat.format(usage.lastActivity)}` : undefined,
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
      const { added, skipped } = await importJson(file);
      importMessage = [
        added === 0
          ? 'Geen nieuwe wandelingen gevonden.'
          : `${added === 1 ? '1 wandeling' : `${added} wandelingen`} geïmporteerd, te vinden bij Vorige wandelingen.`,
        skipped > 0 && `${skipped} stond${skipped === 1 ? '' : 'en'} er al.`,
      ]
        .filter(Boolean)
        .join(' ');
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
                  {note.tester} · {noteDateFormat.format(note.recordedAt)}{note.sessionName
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
      Feedback komt binnen zodra de app van een tester deelt, na het stoppen van een wandeling.
      Verwerkt verbergt hem alleen; de gedeelde wandelingen blijven bewaard.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Tester uitnodigen</h2></div>
  <form class="card-body stack" onsubmit={invite}>
    <label>
      Naam
      <input
        bind:value={name}
        required
        pattern="[A-Za-z0-9_\-]{'{'}1,32{'}'}"
        title="Zonder spaties of accenten"
        autocapitalize="none"
        autocomplete="off"
      />
    </label>
    <label>
      E-mailadres
      <input type="email" bind:value={email} required autocomplete="off" />
    </label>
    <button class="btn" class:secondary={invited} disabled={inviting}>Code maken</button>
    {#if inviteError}
      <p class="message error">{inviteError}</p>
    {/if}
    {#if invited}
      <p class="message">Code voor {invited.name} gemaakt.</p>
      <a class="btn" href={invited.mailto}>Mail openen</a>
      <p class="hint">
        Opent je mail-app met het bericht. Lukt dat niet,
        <button type="button" class="link" onclick={() => copyLink('new', invited!.link)}>
          {copied === 'new' ? 'gekopieerd' : 'kopieer dan de link'}
        </button>
        en stuur hem zelf.
      </p>
    {/if}
    <p class="hint">
      De naam komt in de feedback en de logs; het e-mailadres wordt nergens bewaard. De mail gaat
      vanaf je eigen adres.
    </p>
    {#if PLAY_TEST_LINKS[CHANNEL]}
      <p class="hint">
        Android: zet het Google-account van de tester eerst op de testerslijst in de Play Console;
        anders werkt de link voor deelname niet.
      </p>
    {/if}
  </form>
</section>

<section class="card">
  <div class="card-head"><h2>Testers en installaties</h2></div>
  <div class="card-body stack">
    {#if testersError}
      <p class="message error">{testersError}</p>
    {/if}
    {#if testers?.length === 0}
      <p class="hint">Nog geen testers.</p>
    {:else if testers}
      <ul class="testers">
        {#each testers as tester (tester.name)}
          <li>
            <span class="name">
              {tester.name}
              <span class="muted">
                {tester.source === 'secret'
                  ? '· via npm run tester'
                  : tester.invitedAt
                    ? `· ${dateFormat.format(tester.invitedAt)}`
                    : ''}
                {tester.source === 'install'
                  ? `· zonder code (${tester.via === 'play' ? 'Play' : 'browser'})`
                  : ''}
                {tester.blocked ? '· afgesloten' : ''}
              </span>
              <span class="usage muted">{usageText(tester.usage)}</span>
            </span>
            {#if tester.source === 'app' && tester.code}
              <button class="link" onclick={() => copyLink(tester.name, inviteLink(tester.code!))}>
                {copied === tester.name ? 'Gekopieerd' : 'Link'}
              </button>
              <button class="link danger" onclick={() => remove(tester)}>Afsluiten</button>
            {:else if tester.source === 'install' && !tester.blocked}
              <button class="link danger" onclick={() => remove(tester)}>Afsluiten</button>
            {/if}
          </li>
        {/each}
      </ul>
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
          : ''}{costs.perWalk !== undefined ? ` · ${money(costs.perWalk)} per wandeling` : ''}
      </p>
      {#if costs.perTester.length}
        <h3>Per tester, deze maand</h3>
        <ul class="bars">
          {#each costs.perTester as tester (tester.tester)}
            <li>
              <div class="bar-label">
                <span>{tester.tester}</span>
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
        <h3>Duurste wandelingen</h3>
        <ul class="walks">
          {#each costs.topWalks as walk (`${walk.tester}/${walk.session}`)}
            <li>
              <span>
                {walkNames[walk.session] ?? walk.tester}
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
      telt mee bij de eigenaar, zonder wandeling. In dollars, met de prijzen van 24 oktober 2026. De
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
      Wandelingen importeren (JSON)
      <input type="file" accept="application/json,.json" onchange={importData} />
    </label>
    {#if importMessage}
      <p class="message">{importMessage}</p>
    {/if}
    <p class="hint">
      Importeren leest een eerdere export weer in. Alleen wandelingen die er nog niet zijn; opnames
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
