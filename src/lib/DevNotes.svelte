<script lang="ts">
  import { liveQuery } from 'dexie';
  import {
    addTypedNote,
    deleteNote,
    devNotesMarkdown,
    listDevNotes,
    mapsUrl,
    noteText,
  } from './devNotes';
  import { db, type Utterance } from './db';
  import ShareSettings from './ShareSettings.svelte';

  const notes = liveQuery(listDevNotes);

  // Getypte feedback hoort bij de lopende wandeling, als die er is
  const active = liveQuery(() => db.sessions.where('status').equals('active').first());

  let text = $state('');

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await addTypedNote(text, $active?.id);
    text = '';
  }

  async function remove(note: Utterance) {
    const preview = noteText(note);
    const short = preview.length > 60 ? `${preview.slice(0, 60)}…` : preview;
    if (confirm(`Deze feedback weghalen?\n\n"${short}"`)) await deleteNote(note.id);
  }

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

<form class="card add" onsubmit={add}>
  <textarea
    bind:value={text}
    rows="3"
    placeholder="Wat viel je op? Bijvoorbeeld: hij herkende blako niet"
    aria-label="Nieuwe feedback"
  ></textarea>
  <button class="btn" disabled={!text.trim()}>Toevoegen</button>
</form>

{#if $notes?.length}
  <ul class="card">
    {#each $notes as note (note.id)}
      <li>
        <div>{noteText(note)}</div>
        <div class="meta">
          <span>
            {dateTimeFormat.format(note.recordedAt)}
            {#if note.position}
              ·
              <a href={mapsUrl(note.position.lat, note.position.lon)} target="_blank" rel="noopener">
                locatie
              </a>
            {/if}
          </span>
          <button class="link danger" onclick={() => remove(note)}>Weg</button>
        </div>
      </li>
    {/each}
  </ul>
{:else if $notes}
  <p class="muted">Nog geen feedback.</p>
{/if}

<p class="muted">
  Typ hierboven, of spreek het in tijdens het vogelen: begin een uitspraak met
  <em>"feedback"</em>, bijvoorbeeld
  <em>"feedback, hij herkende blako niet, terwijl dat toch echt bladkoning betekent"</em>. Feedback gaat na de wandeling mee naar de ontwikkelaar,
  als delen aanstaat.
</p>

<ShareSettings />

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

  .muted {
    margin-bottom: 1rem;
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

  .add {
    display: grid;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
    padding: 0.75rem;
  }

  .add .btn {
    justify-self: end;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.15rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  a {
    color: inherit;
  }
</style>
