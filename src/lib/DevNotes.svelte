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
  import { onDestroy } from 'svelte';
  import { SHARE_CHANGED, sentNoteIds, shareEnabled } from './share';
  import ShareSettings from './ShareSettings.svelte';

  const notes = liveQuery(listDevNotes);

  // Wat al verstuurd is (share.ts), opnieuw lezen na elke ronde en bij aan/uit
  let sharing = $state(shareEnabled());
  let sent = $state(sentNoteIds());
  const onShareChanged = () => {
    sharing = shareEnabled();
    sent = sentNoteIds();
  };
  window.addEventListener(SHARE_CHANGED, onShareChanged);
  onDestroy(() => window.removeEventListener(SHARE_CHANGED, onShareChanged));

  // Met delen aan: verstuurde feedback ingeklapt, maar pas na een dag. Anders
  // verdwijnt wat je net typte zodra het (automatisch) verstuurd is, en lijkt
  // het of de volgende het overschreef.
  const RECENT_MS = 24 * 60 * 60_000;
  const isEarlier = (n: Utterance) => sent.has(n.id) && n.recordedAt < Date.now() - RECENT_MS;
  let fresh = $derived(sharing ? ($notes ?? []).filter((n) => !isEarlier(n)) : ($notes ?? []));
  let earlier = $derived(sharing ? ($notes ?? []).filter(isEarlier) : []);

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
    <button class="btn secondary" onclick={copy}
      >{copied ? 'Gekopieerd ✓' : 'Kopieer als Markdown'}</button
    >
  {/if}
</div>

<form class="card add" onsubmit={add}>
  <textarea
    bind:value={text}
    rows="3"
    placeholder="Wat viel je op? Bijvoorbeeld: hij herkende blako niet"
    aria-label="Nieuwe feedback"></textarea>
  <button class="btn" disabled={!text.trim()}>Toevoegen</button>
</form>

{#snippet list(items: Utterance[])}
  <ul class="card">
    {#each items as note (note.id)}
      <li>
        <div>{noteText(note)}</div>
        <div class="meta">
          <span>
            {dateTimeFormat.format(note.recordedAt)}
            {#if note.position}
              ·
              <a
                href={mapsUrl(note.position.lat, note.position.lon)}
                target="_blank"
                rel="noopener"
              >
                locatie
              </a>
            {/if}
            {#if sharing}
              ·
              {#if sent.has(note.id)}
                verstuurd ✓
              {:else if note.sessionId && note.sessionId === $active?.id}
                gaat mee na de wandeling
              {:else}
                nog niet verstuurd
              {/if}
            {/if}
          </span>
          <button class="link danger" onclick={() => remove(note)}>Weg</button>
        </div>
      </li>
    {/each}
  </ul>
{/snippet}

{#if fresh.length}
  {@render list(fresh)}
{:else if $notes && !earlier.length}
  <p class="muted">Nog geen feedback.</p>
{:else if $notes}
  <p class="muted">Alle feedback is verstuurd.</p>
{/if}

{#if earlier.length}
  <details class="earlier">
    <summary>Eerder verstuurd ({earlier.length})</summary>
    {@render list(earlier)}
  </details>
{/if}

<p class="muted">
  Typ hierboven, of spreek het in tijdens het vogelen: begin een uitspraak met
  <em>"feedback"</em>, bijvoorbeeld
  <em>"feedback, hij herkende blako niet, terwijl dat toch echt bladkoning betekent"</em>. Feedback
  gaat na de wandeling mee naar de ontwikkelaar, als delen aanstaat. Verstuurde feedback blijft hier
  staan; weghalen kan altijd.
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

  .earlier {
    margin: 0.75rem 0 1rem;
  }

  .earlier summary {
    margin-bottom: 0.5rem;
    color: var(--muted);
    cursor: pointer;
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
