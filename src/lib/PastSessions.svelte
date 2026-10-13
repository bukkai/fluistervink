<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Session } from './db';
  import { countPerSession, deleteSessions, formatDuration } from './sessions';

  let { sessions }: { sessions: Session[] } = $props();

  const counts = liveQuery(countPerSession);

  /** Opruimen: wandelingen aanvinken en in één keer verwijderen */
  let selecting = $state(false);
  let selected = $state<Set<string>>(new Set());

  let exportedIds = $derived(sessions.filter((s) => s.exportedAt).map((s) => s.id));

  /**
   * Leeg: geen waarnemingen, geen feedback en geen onverwerkte uitspraken.
   * Een wandeling met alleen feedback telt niet als leeg, want die gaan mee
   * als de wandeling weg is; met een mislukte uitspraak (geen bereik) ook
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
      `${n === 1 ? '1 wandeling' : `${n} wandelingen`} voorgoed verwijderen, met alle waarnemingen en opnames?`,
      notExported > 0 &&
        `${notExported === 1 ? 'Eén daarvan is' : `${notExported} daarvan zijn`} nog niet geëxporteerd.`,
      devNotes > 0 &&
        `${devNotes === 1 ? '1 feedbackbericht gaat' : `${devNotes} feedbackberichten gaan`} ook weg.`,
      unprocessed > 0 &&
        `${unprocessed === 1 ? '1 uitspraak is' : `${unprocessed} uitspraken zijn`} nog niet verwerkt (bv. geen bereik) en ${unprocessed === 1 ? 'gaat' : 'gaan'} verloren.`,
    ]
      .filter(Boolean)
      .join('\n\n');
    if (!confirm(message)) return;
    await deleteSessions([...selected]);
    stopSelecting();
  }

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
  const dateFormat = new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  /** "1 u 5 min · 12 uitspraken · 15 waarnemingen" */
  function summary(session: Session): string {
    const c = $counts?.get(session.id);
    return [
      formatDuration((session.endedAt ?? session.startedAt) - session.startedAt),
      c && `${c.utterances} ${c.utterances === 1 ? 'uitspraak' : 'uitspraken'}`,
      c && `${c.observations} ${c.observations === 1 ? 'waarneming' : 'waarnemingen'}`,
      c?.devNotes && `${c.devNotes} ${c.devNotes === 1 ? 'feedbackbericht' : 'feedbackberichten'}`,
      c?.unprocessed && `${c.unprocessed} niet verwerkt`,
    ]
      .filter(Boolean)
      .join(' · ');
  }
</script>

<a class="back" href="#/">Terug</a>
<div class="title">
  <h2 class="page-title">Vorige wandelingen</h2>
  {#if sessions.length > 0}
    {#if selecting}
      <button class="link" onclick={stopSelecting}>Annuleren</button>
    {:else}
      <button class="link" onclick={() => (selecting = true)}>Opruimen</button>
    {/if}
  {/if}
</div>

{#if sessions.length === 0}
  <p class="muted">Nog geen wandelingen.</p>
{:else}
  {#if selecting}
    <p class="muted hint">Vink de wandelingen aan die weg mogen.</p>
    <p class="quick">
      <button class="link" onclick={toggleAll}>{allSelected ? 'Niets' : 'Alles'} aanvinken</button>
      {#if exportedIds.length > 0}
        <button class="link" onclick={() => (selected = new Set(exportedIds))}>
          Alle geëxporteerde
        </button>
      {/if}
      {#if emptyIds.length > 0}
        <button class="link" onclick={() => (selected = new Set(emptyIds))}>
          Alle lege ({emptyIds.length})
        </button>
      {/if}
    </p>
  {/if}
  <ul class="card">
    {#each sessions as session (session.id)}
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
          <a class="row" href="#wandeling/{session.id}">
            {@render content(session)}
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        {/if}
      </li>
    {/each}
  </ul>

  {#if selecting}
    <div class="actions">
      <button
        class="btn danger block large"
        disabled={selected.size === 0}
        onclick={removeSelected}
      >
        {selected.size === 0
          ? 'Niets aangevinkt'
          : `Verwijder ${selected.size === 1 ? '1 wandeling' : `${selected.size} wandelingen`}`}
      </button>
    </div>
  {/if}
{/if}

{#snippet content(session: Session)}
  <span class="text">
    <span class="top">
      <strong>{session.place?.name ?? 'Wandeling'}</strong>
      {#if session.exportedAt}
        <span class="badge exported">geëxporteerd</span>
      {:else}
        <span class="badge">niet geëxporteerd</span>
      {/if}
    </span>
    <span class="when">
      {dateFormat.format(session.startedAt)}, {timeFormat.format(session.startedAt)}
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

  .hint {
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
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .top strong {
    overflow: hidden;
    font-size: 1.05rem;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .badge {
    flex: none;
    padding: 0 0.55rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--amber);
    background: var(--amber-soft);
  }

  .badge.exported {
    color: var(--brand-strong);
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }

  /* Knop blijft onderaan in beeld bij een lange lijst */
  .actions {
    position: sticky;
    bottom: 0;
    padding: 0.75rem 0;
    background: var(--bg);
  }
</style>
