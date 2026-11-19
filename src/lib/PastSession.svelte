<script lang="ts">
  import { LOCALE, t } from './i18n';
  import { timeFormat } from './format';
  import { liveQuery } from 'dexie';
  import { db, type Session } from './db';
  import { renameSession } from './area';
  import { countSpecies, listObservations } from './observations';
  import { deleteSessions, formatDuration, resumeSession } from './sessions';
  import ChecklistAnswers from './ChecklistAnswers.svelte';
  import EbirdEffort from './EbirdEffort.svelte';
  import { sessionDurationMs } from './effort';
  import { confirmDeleteText, countRecordings, deleteRecordings } from './recordings';
  import ObservationMap from './ObservationMap.svelte';
  import SessionLog from './SessionLog.svelte';
  import SessionSummary from './SessionSummary.svelte';
  import { preferenceOn } from './preferences';
  import UncertainReview from './UncertainReview.svelte';
  import { IMPORT_URL, approveSession, exportForWaarneming, markReady } from './waarnemingExport';

  // Een afgelopen sessie nalopen en klaarzetten voor waarneming.nl (de
  // export zelf gaat voor alle klaarstaande sessies tegelijk, op het
  // scherm Sessies). Hier kom je ook meteen na "Stop sessie".

  /**
   * `resumable`: de meest recente sessie, en er loopt geen andere.
   * `justSaved`: net gestopt; dan een bevestiging bovenaan.
   */
  let {
    session,
    resumable,
    justSaved = false,
  }: { session: Session; resumable: boolean; justSaved?: boolean } = $props();

  let observations = $derived(liveQuery(() => listObservations(session.id)));
  let uncertainCount = $derived($observations?.filter((obs) => obs.uncertain).length ?? 0);

  // Uitspraken die nog niet verwerkt zijn (vooral: wachten op bereik). Pas als
  // ze binnen zijn klopt de lijst, dus dan pas klaarzetten of exporteren.
  let unprocessed = $derived(
    liveQuery(() =>
      db.utterances
        .where('status')
        .anyOf('pending', 'processing')
        .filter((u) => u.sessionId === session.id)
        .count(),
    ),
  );

  // Kaart en lijst aan elkaar gekoppeld: een nieuw object bij elke tik, zodat
  // ook nog eens dezelfde waarneming kiezen opnieuw werkt.
  let mapFocus = $state<{ id: string }>();
  let listFocus = $state<{ ids: string[] }>();

  async function resume() {
    if (!confirm(t('past.confirmResume'))) return;
    if (await resumeSession(session.id)) location.hash = '';
  }

  async function remove() {
    const message = session.exportedAt
      ? t('past.confirmDelete')
      : t('past.confirmDeleteNotExported');
    if (!confirm(message)) return;
    await deleteSessions([session.id]);
    location.hash = 'sessies';
  }

  // Alleen de opnames wissen; de sessie, de tekst en de waarnemingen blijven
  let recordings = $derived(liveQuery(() => countRecordings(session.id)));

  async function removeRecordings() {
    const current = await countRecordings(session.id);
    if (!current.count || !confirm(confirmDeleteText(current, t('recordings.scopeSession'))))
      return;
    await deleteRecordings(session.id);
  }

  async function rename() {
    const name = prompt(t('past.renamePrompt'), session.place?.name ?? '');
    if (name !== null) await renameSession(session.id, name);
  }

  // Voor wie eBird gebruikt: de vraag "alles genoteerd?" meteen na Stop, en nog
  // één keer bij het klaarzetten als hij dan nog open is (docs/plan-ebird.md,
  // punt 8). Wegtikken mag; het eBird-kaartje blijft de plek om het aan te passen.
  const ebird = preferenceOn('ebird');
  /** Net op "Alles klopt" getikt: de vraag staat dan bij die knop, niet bovenaan */
  let askedAtReady = $state(false);
  let dismissed = $state(false);
  /** Hier beantwoord: de vraag blijft staan voor het aantal waarnemers, tot "Klaar" */
  let answered = $state(false);
  let asking = $derived(
    ebird &&
      !dismissed &&
      (justSaved || askedAtReady) &&
      !!$observations?.length &&
      (answered || session.checklist?.complete === undefined),
  );

  function closeQuestion() {
    dismissed = true;
    answered = false;
  }

  /** Uitkomst van de laatste export, om onder de knop te tonen */
  let exportResult = $state<string>();

  /** "Alles klopt": de rest geldt als nagelopen (ook de onzekere), en de sessie staat klaar */
  async function ready() {
    if (uncertainCount > 0 && !confirm(t('past.confirmReady', { n: uncertainCount }))) return;
    await approveSession(session.id);
    askedAtReady = true;
    dismissed = false;
    answered = false;
  }

  async function exportOnlyThis() {
    exportResult = (await exportForWaarneming([session])) ?? exportResult;
  }

  const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'full' });
</script>

{#snippet checklistQuestion()}
  <section class="card question" aria-label={t('past.ebirdQuestionLabel')}>
    <div class="card-head"><h2>{t('past.forEbird')}</h2></div>
    <div class="card-body">
      <ChecklistAnswers {session} onanswer={() => (answered = true)} />
      <button class="btn secondary block" onclick={closeQuestion}
        >{answered ? t('past.done') : t('past.notNow')}</button
      >
    </div>
  </section>
{/snippet}

<a class="back" href="#sessies">{t('past.back')}</a>

{#if justSaved}
  <div class="saved" role="status">
    <strong>{t('past.savedTitle')}</strong>
    <p>{t('past.savedText')}</p>
  </div>
{/if}

{#if asking && !askedAtReady}
  {@render checklistQuestion()}
{/if}

<header>
  <div class="title">
    <h2 class="page-title">{session.place?.name ?? t('common.defaultSessionName')}</h2>
    <button class="rename" onclick={rename} aria-label={t('past.rename')} title={t('past.rename')}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
  <p class="muted">
    {t('past.when', {
      date: dateFormat.format(session.startedAt),
      from: timeFormat.format(session.startedAt),
      to: session.endedAt ? timeFormat.format(session.endedAt) : '?',
    })}
  </p>
</header>

{#if $observations}
  <dl class="stats">
    <div>
      <dt>{t('past.duration')}</dt>
      <dd>{formatDuration(sessionDurationMs(session, session.endedAt ?? session.startedAt))}</dd>
    </div>
    <div>
      <dt>{t('past.species')}</dt>
      <dd>{countSpecies($observations)}</dd>
    </div>
    <div>
      <!-- Afbreekpunt voor een heel smalle telefoon -->
      <dt>{t('past.observations')}</dt>
      <dd>
        {$observations.length}
        {#if uncertainCount > 0}<small>{t('past.uncertainCount', { n: uncertainCount })}</small
          >{/if}
      </dd>
    </div>
  </dl>
{/if}

<SessionSummary {session} />

{#if !session.exportedAt}
  <UncertainReview {session} />
{/if}

<ObservationMap {session} focus={mapFocus} onselect={(ids) => (listFocus = { ids })} />

<SessionLog {session} focus={listFocus} onshowonmap={(id) => (mapFocus = { id })} />

<section class="card export">
  <div class="card-head">
    <h2>{t('past.readyTitle')}</h2>
    {#if session.exportedAt && !exportResult}
      <span class="badge">{t('sessions.badgeExported')}</span>
    {:else if session.readyAt && !exportResult}
      <span class="badge">{t('sessions.badgeReady')}</span>
    {/if}
  </div>
  <div class="card-body">
    {#if exportResult}
      <p>{exportResult}</p>
    {:else if session.exportedAt}
      <p class="muted">
        {t('past.exportedOn', {
          date: dateFormat.format(session.exportedAt),
          time: timeFormat.format(session.exportedAt),
        })}
      </p>
    {:else if session.readyAt}
      <p class="first">
        {t('past.isReady')}
      </p>
      <div class="actions">
        <a class="btn block" href="#sessies">{t('past.toSessions')}</a>
        <button class="btn secondary block" onclick={() => markReady(session.id, false)}
          >{t('past.notReadyYet')}</button
        >
      </div>
    {:else if $unprocessed}
      <p class="first">
        {t('past.unprocessed', { n: $unprocessed })}
      </p>
    {:else}
      {#if uncertainCount > 0}
        <p class="warning">
          {t('past.uncertainLeft', { n: uncertainCount })}
        </p>
      {/if}
      <button class="btn block large" onclick={ready}
        >{ebird ? t('past.allCorrectEbird') : t('past.allCorrect')}</button
      >
      <p class="muted">
        {ebird ? t('past.readyHintEbird') : t('past.readyHint')}
      </p>
    {/if}
    <div class="actions only-this">
      <button class="btn secondary block" onclick={exportOnlyThis} disabled={!!$unprocessed}
        >{ebird ? t('past.exportOnlyThisEbird') : t('past.exportOnlyThis')}</button
      >
    </div>
    <p class="muted">
      {t('past.importHintVoor')}
      <a href={IMPORT_URL} target="_blank" rel="noopener">waarneming.nl</a>{t('past.importHintNa')}
    </p>
  </div>
</section>

{#if asking && askedAtReady}
  {@render checklistQuestion()}
{/if}

<!-- eBird bij de export, net onder waarneming.nl: zelfde "klaar", eigen export -->
{#if ebird}
  <EbirdEffort {session} />
{/if}

<!-- Knoppen in plaats van linkjes: ook met dikke vingers of handschoenen te raken -->
<div class="footer actions">
  {#if resumable}
    <button class="btn secondary block" onclick={resume}>{t('past.resume')}</button>
  {/if}
  {#if $recordings?.count}
    <button class="btn secondary block danger-text" onclick={removeRecordings}
      >{t('past.deleteRecordings')}</button
    >
  {/if}
  <button class="btn secondary block danger-text" onclick={remove}>{t('past.delete')}</button>
</div>

<style>
  a:not(.btn) {
    color: var(--brand-strong);
  }

  .saved {
    margin-top: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: var(--radius);
    background: var(--success);
    color: white;
  }

  .saved strong {
    font-size: 1.1rem;
  }

  .saved p {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
  }

  .question .btn {
    min-height: 3rem;
  }

  header {
    margin-top: 0.5rem;
  }

  header .page-title {
    margin-bottom: 0.15rem;
  }

  header p {
    margin: 0;
  }

  .title {
    display: flex;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .title .page-title {
    flex: 1;
    min-width: 0;
  }

  /* Potloodje: 48 px tikvlak, ook met dikke vingers */
  .rename {
    display: grid;
    flex: none;
    place-items: center;
    width: 3rem;
    height: 3rem;
    margin: -0.4rem -0.6rem 0 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    color: var(--brand-strong);
    background: none;
    cursor: pointer;
  }

  .rename:active {
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }

  .stats {
    display: grid;
    /* Elk tegeltje minstens zo breed als zijn inhoud: niets afkappen */
    grid-template-columns: repeat(3, auto);
    gap: 0.5rem;
    margin: 1rem 0;
  }

  .stats div {
    padding: 0.6rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .stats dt {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
  }

  .stats dd {
    margin: 0.1rem 0 0;
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .stats small {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--amber);
  }

  .export p {
    margin: 0.75rem 0 0;
    font-size: 0.9rem;
  }

  .export .warning {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.6rem;
    color: var(--amber);
    background: var(--amber-soft);
  }

  .badge {
    padding: 0 0.55rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--brand-strong);
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }

  .actions {
    display: grid;
    gap: 0.5rem;
  }

  .actions .btn {
    min-height: 3rem;
  }

  .export .first {
    margin-top: 0;
    margin-bottom: 0.75rem;
  }

  .only-this {
    margin-top: 1rem;
  }

  .export .only-this + p {
    margin-top: 0.4rem;
  }

  .footer {
    margin: 1.5rem 0 1rem;
  }

  .danger-text {
    color: var(--red);
  }
</style>
