<script lang="ts">
  import { t } from './i18n';
  import { dayFormat, timeFormat } from './format';
  import { liveQuery } from 'dexie';
  import type { Session } from './db';
  import {
    countPerSession,
    deleteSessions,
    formatDuration,
    isFiledAway,
    notForExport,
  } from './sessions';
  import { EBIRD_IMPORT_URL, exportForEbird, pendingForEbird, setChecklist } from './ebirdExport';
  import { preferenceOn, preferenceSince } from './preferences';
  import { IMPORT_URL, exportForWaarneming, readyForExport } from './waarnemingExport';

  let { sessions }: { sessions: Session[] } = $props();

  const counts = liveQuery(countPerSession);

  /** Opruimen: sessies aanvinken en in één keer verwijderen */
  let selecting = $state(false);
  let selected = $state<Set<string>>(new Set());

  /** Nagelopen sessies, samen in één bestand naar waarneming.nl */
  let ready = $derived(readyForExport(sessions));
  let exportResult = $state<string>();

  async function exportReady() {
    exportResult = (await exportForWaarneming(ready)) ?? exportResult;
  }

  // Voor wie eBird gebruikt: dezelfde nagelopen sessies ook als checklists,
  // in één bestand (docs/plan-ebird.md, punt 8). Lege sessies doen niet mee.
  const ebird = preferenceOn('ebird');
  const ebirdSince = preferenceSince('ebird');
  let ebirdPending = $derived(
    ebird
      ? pendingForEbird(sessions, ebirdSince).filter(
          (s) => !$counts || ($counts.get(s.id)?.observations ?? 0) > 0,
        )
      : [],
  );
  /** Vangnet: waar "alles genoteerd?" nog open is; tot die beantwoord zijn, is de knop uit */
  let ebirdOpen = $derived(ebirdPending.filter((s) => s.checklist?.complete === undefined));
  let ebirdResult = $state<string>();
  let ebirdBusy = $state(false);

  async function exportEbird() {
    ebirdBusy = true;
    try {
      ebirdResult = (await exportForEbird(ebirdPending)) ?? ebirdResult;
    } finally {
      ebirdBusy = false;
    }
  }

  // Afgehandelde sessies van meer dan een week geleden ingeklapt, zodat
  // bovenaan staat wat nog aandacht vraagt. Bij opruimen staat alles open.
  let filedAwayIds = $derived.by(() => {
    const pending = new Set(ebirdPending.map((s) => s.id));
    return new Set(sessions.filter((s) => isFiledAway(s, ebird, pending)).map((s) => s.id));
  });
  let filedAway = $derived(sessions.filter((s) => filedAwayIds.has(s.id)));
  let recent = $derived(sessions.filter((s) => !filedAwayIds.has(s.id)));

  let exportedIds = $derived(sessions.filter((s) => s.exportedAt).map((s) => s.id));

  /**
   * Leeg: geen waarnemingen, geen feedback en geen onverwerkte uitspraken.
   * Een sessie met alleen feedback telt niet als leeg, want die gaan mee
   * als de sessie weg is; met een mislukte uitspraak (geen bereik) ook
   * niet, want daar kan nog een waarneming in zitten.
   */
  let emptyIds = $derived(
    $counts
      ? sessions
          .filter((s) => {
            const c = $counts.get(s.id);
            return !c || (c.observations === 0 && c.devNotes === 0 && c.unprocessed === 0);
          })
          .map((s) => s.id)
      : [],
  );

  let allSelected = $derived(sessions.length > 0 && selected.size === sessions.length);

  function toggleAll() {
    selected = allSelected ? new Set() : new Set(sessions.map((s) => s.id));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function stopSelecting() {
    selecting = false;
    selected = new Set();
  }

  async function removeSelected() {
    const n = selected.size;
    const notExported = sessions.filter((s) => selected.has(s.id) && !s.exportedAt).length;
    const devNotes = [...selected].reduce((sum, id) => sum + ($counts?.get(id)?.devNotes ?? 0), 0);
    const unprocessed = [...selected].reduce(
      (sum, id) => sum + ($counts?.get(id)?.unprocessed ?? 0),
      0,
    );
    const message = [
      t('sessions.confirmDelete', { n }),
      notExported > 0 && t('sessions.confirmNotExported', { n: notExported }),
      devNotes > 0 && t('sessions.confirmDevNotes', { n: devNotes }),
      unprocessed > 0 && t('sessions.confirmUnprocessed', { n: unprocessed }),
    ]
      .filter(Boolean)
      .join('\n\n');
    if (!confirm(message)) return;
    await deleteSessions([...selected]);
    stopSelecting();
  }

  /** "1 u 5 min · 12 uitspraken · 15 waarnemingen" */
  function summary(session: Session): string {
    const c = $counts?.get(session.id);
    return [
      formatDuration((session.endedAt ?? session.startedAt) - session.startedAt),
      c && t('sessions.utterances', { n: c.utterances }),
      c && t('log.observationCount', { n: c.observations }),
      c?.devNotes && t('sessions.devNotes', { n: c.devNotes }),
      c?.unprocessed && t('sessions.unprocessed', { n: c.unprocessed }),
    ]
      .filter(Boolean)
      .join(' · ');
  }
</script>

<a class="back" href="#/">{t('common.back')}</a>
<div class="title">
  <h2 class="page-title">{t('sessions.title')}</h2>
  {#if sessions.length > 0}
    {#if selecting}
      <button class="link" onclick={stopSelecting}>{t('sessions.cancel')}</button>
    {:else}
      <button class="link" onclick={() => (selecting = true)}>{t('sessions.cleanUp')}</button>
    {/if}
  {/if}
</div>

{#if sessions.length === 0}
  <p class="muted">{t('sessions.none')}</p>
{:else}
  {#if !selecting && (ready.length > 0 || exportResult)}
    <section class="card export">
      <div class="card-body">
        {#if ready.length > 0}
          <p>
            <strong>{t('sessions.readyForWaarneming', { n: ready.length })}</strong>
          </p>
          <button class="btn block large" onclick={exportReady}>
            {t('sessions.exportWaarneming')}
          </button>
        {/if}
        {#if exportResult}
          <p>{exportResult}</p>
        {/if}
        <p class="muted">
          {t('sessions.importHintVoor')}
          <a href={IMPORT_URL} target="_blank" rel="noopener">waarneming.nl</a>{t(
            'sessions.importHintNa',
          )}
        </p>
      </div>
    </section>
  {/if}
  {#if !selecting && (ebirdPending.length > 0 || ebirdResult)}
    <section class="card export">
      <div class="card-body">
        {#if ebirdPending.length > 0}
          <p>
            <strong>{t('sessions.forEbird', { n: ebirdPending.length })}</strong>
          </p>
          {#if ebirdOpen.length > 0}
            <p id="ebird-open">{t('sessions.ebirdQuestion')}</p>
            <ul class="open" aria-labelledby="ebird-open">
              {#each ebirdOpen as session (session.id)}
                <li>
                  <a href="#sessie/{session.id}">
                    <strong>{session.place?.name ?? t('common.defaultSessionName')}</strong>
                    <span class="when">
                      {t('sessions.when', {
                        day: dayFormat.format(session.startedAt),
                        time: timeFormat.format(session.startedAt),
                      })}
                    </span>
                  </a>
                  <div class="answers">
                    <button
                      class="btn secondary"
                      onclick={() => setChecklist(session.id, { complete: true })}
                    >
                      {t('sessions.yes')}
                    </button>
                    <button
                      class="btn secondary"
                      onclick={() => setChecklist(session.id, { complete: false })}
                    >
                      {t('sessions.no')}
                    </button>
                    <button
                      class="btn secondary"
                      onclick={() => setChecklist(session.id, { skipEbird: true })}
                    >
                      {t('sessions.notToEbird')}
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
          <button
            class="btn block large"
            disabled={ebirdBusy || ebirdOpen.length > 0}
            onclick={exportEbird}
          >
            {t('sessions.exportEbird')}
          </button>
        {/if}
        {#if ebirdResult}
          <p role="status">{ebirdResult}</p>
        {/if}
        <p class="muted">
          {#if ebirdOpen.length > 0}
            {t('sessions.answerFirst', { n: ebirdOpen.length })}
          {/if}
          {t('sessions.ebirdHintVoor')}
          <a href={EBIRD_IMPORT_URL} target="_blank" rel="noopener">eBird</a>
          {t('sessions.ebirdHintNa')}
        </p>
      </div>
    </section>
  {/if}
  {#if selecting}
    <p class="muted select-hint">{t('sessions.selectHint')}</p>
    <p class="quick">
      <button class="link" onclick={toggleAll}>
        {allSelected ? t('sessions.selectNone') : t('sessions.selectAll')}
      </button>
      {#if exportedIds.length > 0}
        <button class="link" onclick={() => (selected = new Set(exportedIds))}>
          {t('sessions.selectExported')}
        </button>
      {/if}
      {#if emptyIds.length > 0}
        <button class="link" onclick={() => (selected = new Set(emptyIds))}>
          {t('sessions.selectEmpty', { n: emptyIds.length })}
        </button>
      {/if}
    </p>
  {/if}
  {#if selecting || filedAway.length === 0}
    {@render list(sessions)}
  {:else}
    {#if recent.length > 0}
      {@render list(recent)}
    {/if}
    <details class="filed-away">
      <summary>{t('sessions.filedAway', { n: filedAway.length })}</summary>
      {@render list(filedAway)}
    </details>
  {/if}

  {#if selecting}
    <div class="actions">
      <button
        class="btn danger block large"
        disabled={selected.size === 0}
        onclick={removeSelected}
      >
        {selected.size === 0
          ? t('sessions.nothingSelected')
          : t('sessions.deleteSelected', { n: selected.size })}
      </button>
    </div>
  {/if}
{/if}

{#snippet list(items: Session[])}
  <ul class="card">
    {#each items as session (session.id)}
      <li class:selected={selecting && selected.has(session.id)}>
        {#if selecting}
          <label class="row">
            <input
              type="checkbox"
              checked={selected.has(session.id)}
              onchange={() => toggle(session.id)}
            />
            {@render content(session)}
          </label>
        {:else}
          <a class="row" href="#sessie/{session.id}">
            {@render content(session)}
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet content(session: Session)}
  <span class="text">
    <span class="top">
      <strong>{session.place?.name ?? t('common.defaultSessionName')}</strong>
      <span class="badges">
        {#if session.exportedAt}
          <span class="badge exported">
            {ebird ? t('sessions.badgeWaarneming') : t('sessions.badgeExported')}
          </span>
        {:else if session.readyAt}
          <span class="badge ready">{t('sessions.badgeReady')}</span>
        {:else if !session.ebirdExportedAt && !notForExport(session)}
          <span class="badge">{t('sessions.badgeNotExported')}</span>
        {/if}
        {#if ebird && session.ebirdExportedAt}
          <span class="badge exported">{t('sessions.badgeEbird')}</span>
        {/if}
      </span>
    </span>
    <span class="when">
      {t('sessions.when', {
        day: dayFormat.format(session.startedAt),
        time: timeFormat.format(session.startedAt),
      })}
    </span>
    <span class="muted summary">{summary(session)}</span>
  </span>
{/snippet}

<style>
  .title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .export {
    margin-bottom: 1rem;
  }

  .export p {
    margin: 0 0 0.75rem;
  }

  .export p:last-child {
    margin: 0.75rem 0 0;
    font-size: 0.9rem;
  }

  /* Vangnet voor eBird: per sessie de vraag, met knoppen van 48 px */
  .export .open {
    display: grid;
    gap: 0.75rem;
    margin: 0 0 1rem;
  }

  .open li + li {
    padding-top: 0.75rem;
  }

  .open a {
    display: grid;
    color: inherit;
    text-decoration: none;
  }

  .answers {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.4rem;
  }

  .answers .btn {
    flex: 1;
    min-height: 3rem;
    padding-inline: 0.5rem;
  }

  .select-hint {
    margin: 0 0 0.25rem;
  }

  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.25rem;
    margin: 0 0 0.75rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li + li {
    border-top: 1px solid var(--border);
  }

  li.selected {
    background: color-mix(in srgb, var(--breast) 8%, transparent);
  }

  .row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.8rem 1rem;
    color: inherit;
    text-decoration: none;
  }

  .row input {
    width: 1.25rem;
    height: 1.25rem;
    flex: none;
    accent-color: var(--breast);
  }

  .text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  /* Lange gebiedsnamen lopen door op een tweede regel, naast het label */
  .top strong {
    min-width: 0;
    font-size: 1.05rem;
    overflow-wrap: anywhere;
  }

  .when {
    font-size: 0.95rem;
  }

  .summary {
    font-size: 0.85rem;
  }

  .chevron {
    font-size: 1.5rem;
    color: var(--muted);
  }

  .badges {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 0.2rem;
    align-items: flex-end;
  }

  .badge {
    flex: none;
    padding: 0 0.55rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--amber);
    background: var(--amber-soft);
  }

  .badge.ready {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 12%, transparent);
  }

  .badge.exported {
    color: var(--brand-strong);
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }

  .filed-away {
    margin-top: 1rem;
  }

  /* Groot genoeg om met een duim te raken */
  .filed-away summary {
    padding: 0.75rem 0;
    color: var(--muted);
    cursor: pointer;
  }

  /* Knop blijft onderaan in beeld bij een lange lijst */
  .actions {
    position: sticky;
    bottom: 0;
    padding: 0.75rem 0;
    background: var(--bg);
  }
</style>
