<script lang="ts">
  import { liveQuery } from 'dexie';
  import type { Session } from './db';
  import { countPerSession, formatDuration } from './sessions';

  let { sessions }: { sessions: Session[] } = $props();

  const counts = liveQuery(countPerSession);

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
  const dateFormat = new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  /** "1 u 5 min, 12 uitspraken, 15 waarnemingen, geëxporteerd" */
  function summary(session: Session): string {
    const c = $counts?.get(session.id);
    return [
      formatDuration((session.endedAt ?? session.startedAt) - session.startedAt),
      c && `${c.utterances} ${c.utterances === 1 ? 'uitspraak' : 'uitspraken'}`,
      c && `${c.observations} ${c.observations === 1 ? 'waarneming' : 'waarnemingen'}`,
      session.exportedAt && 'geëxporteerd',
    ]
      .filter(Boolean)
      .join(', ');
  }
</script>

<a class="back" href="#/">← Terug</a>
<h2>Vorige wandelingen</h2>

{#if sessions.length === 0}
  <p class="muted">Nog geen wandelingen.</p>
{:else}
  <ul>
    {#each sessions as session (session.id)}
      <li>
        <a href="#wandeling/{session.id}">
          {#if session.place}<strong>{session.place.name}</strong><br />{/if}
          {dateFormat.format(session.startedAt)},
          {timeFormat.format(session.startedAt)}
          <span class="muted">
            ({summary(session)})
          </span>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .back {
    color: var(--green);
  }

  .muted {
    color: var(--muted);
  }

  ul {
    padding: 0;
    list-style: none;
  }

  li {
    border-bottom: 1px solid var(--border);
  }

  li a {
    display: block;
    padding: 0.75rem 0;
    color: inherit;
    text-decoration: none;
  }

  li a::after {
    content: '›';
    float: right;
    color: var(--muted);
  }
</style>
