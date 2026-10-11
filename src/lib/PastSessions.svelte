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
    const message = [
      `${n === 1 ? '1 wandeling' : `${n} wandelingen`} voorgoed verwijderen, met alle waarnemingen en opnames?`,
      notExported > 0 &&
        `${notExported === 1 ? 'Eén daarvan is' : `${notExported} daarvan zijn`} nog niet geëxporteerd.`,
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

  /** "1 u 5 min, 12 uitspraken, 15 waarnemingen" */
  function summary(session: Session): string {
    const c = $counts?.get(session.id);
    return [
      formatDuration((session.endedAt ?? session.startedAt) - session.startedAt),
      c && `${c.utterances} ${c.utterances === 1 ? 'uitspraak' : 'uitspraken'}`,
      c && `${c.observations} ${c.observations === 1 ? 'waarneming' : 'waarnemingen'}`,
    ]
      .filter(Boolean)
      .join(', ');
  }
</script>

<a class="back" href="#/">← Terug</a>
<div class="title">
  <h2>Vorige wandelingen</h2>
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
    <p class="muted hint">
      Vink de wandelingen aan die weg mogen.
      {#if exportedIds.length > 0}
        <button class="link" onclick={() => (selected = new Set(exportedIds))}>
          Alle geëxporteerde aanvinken
        </button>
      {/if}
    </p>
  {/if}
  <ul>
    {#each sessions as session (session.id)}
      <li>
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
          </a>
        {/if}
      </li>
    {/each}
  </ul>

  {#if selecting}
    <div class="actions">
      <button class="danger" disabled={selected.size === 0} onclick={removeSelected}>
        {selected.size === 0
          ? 'Niets aangevinkt'
          : `Verwijder ${selected.size === 1 ? '1 wandeling' : `${selected.size} wandelingen`}`}
      </button>
    </div>
  {/if}
{/if}

{#snippet content(session: Session)}
  <span class="text">
    {#if session.place}<strong>{session.place.name}</strong><br />{/if}
    {dateFormat.format(session.startedAt)},
    {timeFormat.format(session.startedAt)}
    <span class="muted">({summary(session)})</span>
    <br />
    {#if session.exportedAt}
      <span class="badge exported">geëxporteerd</span>
    {:else}
      <span class="badge">nog niet geëxporteerd</span>
    {/if}
  </span>
{/snippet}

<style>
  .back {
    color: var(--green);
  }

  .title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .muted {
    color: var(--muted);
  }

  .hint {
    margin-top: 0;
  }

  button {
    font: inherit;
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--green);
    text-decoration: underline;
  }

  ul {
    padding: 0;
    list-style: none;
  }

  li {
    border-bottom: 1px solid var(--border);
  }

  .row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.75rem 0;
    color: inherit;
    text-decoration: none;
  }

  .row input {
    width: 1.25rem;
    height: 1.25rem;
    flex: none;
  }

  .text {
    flex: 1;
  }

  a.row::after {
    content: '›';
    color: var(--muted);
  }

  .badge {
    display: inline-block;
    margin-top: 0.25rem;
    padding: 0 0.5rem;
    border: 1px solid var(--border);
    border-radius: 1rem;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .badge.exported {
    border-color: var(--green);
    color: var(--green);
  }

  /* Knop blijft onderaan in beeld bij een lange lijst */
  .actions {
    position: sticky;
    bottom: 0;
    padding: 0.75rem 0;
    background: var(--bg);
  }

  .danger {
    width: 100%;
    padding: 1rem;
    border: none;
    border-radius: 0.75rem;
    font-weight: 600;
    background: var(--red);
    color: white;
  }

  .danger:disabled {
    opacity: 0.5;
  }
</style>
