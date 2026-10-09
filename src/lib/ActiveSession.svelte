<script lang="ts">
  import type { Session } from './db';
  import { gps, startTracking, stopTracking } from './location.svelte';
  import { submitText } from './observations';
  import SessionLog from './SessionLog.svelte';

  let { session }: { session: Session } = $props();

  let text = $state('');

  // GPS aan zolang dit scherm (de lopende wandeling) zichtbaar is
  $effect(() => {
    startTracking();
    return stopTracking;
  });

  const gpsLabels: Record<typeof gps.status, string> = {
    off: '',
    ok: '',
    searching: 'Locatie zoeken…',
    denied: 'Geen toegang tot locatie. Sta dit toe in de browserinstellingen.',
    unavailable: 'Locatie niet beschikbaar op dit apparaat.',
  };

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await submitText(session.id, text);
    text = '';
  }
</script>

<p class="gps {gps.status}">
  {#if gps.status === 'ok' && gps.latest}
    Locatie ±{Math.round(gps.latest.accuracy)} m
  {:else}
    {gpsLabels[gps.status]}
  {/if}
</p>

<form onsubmit={submit}>
  <input
    bind:value={text}
    placeholder="Bv. zes overvliegende houtduiven"
    autocomplete="off"
    enterkeyhint="send"
  />
  <button>Verwerk</button>
</form>

<SessionLog {session} />

<style>
  .gps {
    margin: 0.75rem 0 0;
    font-size: 0.9rem;
    color: var(--muted);
  }

  .gps.denied,
  .gps.unavailable {
    color: var(--red);
  }

  form {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font: inherit;
    background: var(--bg);
    color: var(--fg);
  }

  button {
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font: inherit;
    background: var(--green);
    color: white;
  }
</style>
