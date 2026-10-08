<script lang="ts">
  import { liveQuery } from 'dexie';
  import { onDestroy } from 'svelte';
  import {
    listSessions,
    requestPersistentStorage,
    startSession,
    stopSession,
  } from './lib/sessions';
  import Settings from './lib/Settings.svelte';

  // liveQuery draait opnieuw zodra de data in IndexedDB verandert, en is
  // direct bruikbaar als Svelte-store ($sessions).
  const sessions = liveQuery(listSessions);

  let active = $derived($sessions?.find((s) => s.status === 'active'));
  let past = $derived($sessions?.filter((s) => s.status === 'ended') ?? []);

  // Klok voor de looptijd van de lopende wandeling
  let now = $state(Date.now());
  const timer = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(timer));

  async function start() {
    await startSession();
    requestPersistentStorage();
  }

  async function stop() {
    if (active && confirm('Wandeling stoppen?')) await stopSession(active.id);
  }

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
  const dateFormat = new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  function duration(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h} u ${m} min` : `${m} min`;
  }
</script>

<main>
  <h1>Thijsse</h1>

  {#if $sessions === undefined}
    <!-- Database wordt nog geladen -->
  {:else if active}
    <section class="active">
      <p>
        Wandeling bezig sinds {timeFormat.format(active.startedAt)}
        <span class="muted">({duration(now - active.startedAt)})</span>
      </p>
      <button class="stop" onclick={stop}>Stop wandeling</button>
    </section>
  {:else}
    <button class="start" onclick={start}>Start wandeling</button>
  {/if}

  {#if past.length > 0}
    <h2>Eerdere wandelingen</h2>
    <ul>
      {#each past as session (session.id)}
        <li>
          {dateFormat.format(session.startedAt)},
          {timeFormat.format(session.startedAt)}
          <span class="muted">
            ({duration((session.endedAt ?? session.startedAt) - session.startedAt)})
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  <Settings />
</main>

<style>
  main {
    max-width: 32rem;
    margin: 0 auto;
    padding: 1rem;
  }

  button {
    width: 100%;
    padding: 1.5rem;
    border: none;
    border-radius: 1rem;
    font: inherit;
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
  }

  .start {
    background: var(--green);
  }

  .stop {
    background: var(--red);
  }

  .muted {
    color: var(--muted);
  }

  ul {
    padding: 0;
    list-style: none;
  }

  li {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border);
  }
</style>
