<script lang="ts">
  import { liveQuery } from 'dexie';
  import { devNotesMarkdown, listDevNotes, mapsUrl, noteText } from './devNotes';

  const notes = liveQuery(listDevNotes);

  let copied = $state(false);

  async function copy() {
    if (!$notes) return;
    await navigator.clipboard.writeText(await devNotesMarkdown($notes));
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  const dateTimeFormat = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
</script>

{#if $notes?.length}
  <details>
    <summary>Dev notes ({$notes.length})</summary>
    <button onclick={copy}>{copied ? 'Gekopieerd' : 'Kopieer als Markdown'}</button>
    <ul>
      {#each $notes as note (note.id)}
        <li>
          <div>{noteText(note)}</div>
          <div class="muted">
            {dateTimeFormat.format(note.recordedAt)}
            {#if note.position}
              ·
              <a href={mapsUrl(note.position.lat, note.position.lon)} target="_blank" rel="noopener">
                locatie
              </a>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </details>
{/if}

<style>
  details {
    margin-top: 1.5rem;
  }

  summary {
    font-weight: 600;
  }

  button {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font: inherit;
    background: var(--bg);
    color: var(--fg);
  }

  ul {
    padding: 0;
    list-style: none;
  }

  li {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }

  .muted {
    color: var(--muted);
    font-size: 0.9rem;
  }

  a {
    color: inherit;
  }
</style>
