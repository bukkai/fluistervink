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

<a class="back" href="#/">Terug</a>
<div class="title">
  <h2 class="page-title">Feedback</h2>
  {#if $notes?.length}
    <button class="btn secondary" onclick={copy}>{copied ? 'Gekopieerd ✓' : 'Kopieer als Markdown'}</button>
  {/if}
</div>

{#if $notes?.length}
  <ul class="card">
    {#each $notes as note (note.id)}
      <li>
        <div>{noteText(note)}</div>
        <div class="meta">
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
{:else if $notes}
  <p class="muted">Nog geen feedback.</p>
{/if}

<p class="muted">
  Iets gemerkt tijdens het vogelen? Begin een uitspraak met <em>"feedback"</em>, bijvoorbeeld
  <em>"feedback, hij trilde niet"</em>. Feedback gaat na de wandeling mee naar de ontwikkelaar
  (zie <a href="#instellingen">Instellingen</a>).
</p>

<style>
  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .title .btn {
    padding: 0.45rem 0.8rem;
    font-size: 0.85rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    padding: 0.75rem 1rem;
  }

  li + li {
    border-top: 1px solid var(--border);
  }

  .meta {
    margin-top: 0.15rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  a {
    color: inherit;
  }
</style>
