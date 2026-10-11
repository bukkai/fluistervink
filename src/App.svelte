<script lang="ts">
  import { liveQuery } from 'dexie';
  import { onDestroy } from 'svelte';
  import {
    formatDuration,
    listSessions,
    requestPersistentStorage,
    startSession,
    stopSession,
  } from './lib/sessions';
  import ActiveSession from './lib/ActiveSession.svelte';
  import { getAccessCode } from './lib/api';
  import { listDevNotes } from './lib/devNotes';
  import { processQueue } from './lib/observations';
  import DevNotes from './lib/DevNotes.svelte';
  import PastSession from './lib/PastSession.svelte';
  import PastSessions from './lib/PastSessions.svelte';
  import Settings from './lib/Settings.svelte';

  // Uitspraken die bij het afsluiten nog niet verwerkt waren, alsnog verwerken
  processQueue();

  // liveQuery draait opnieuw zodra de data in IndexedDB verandert, en is
  // direct bruikbaar als Svelte-store ($sessions).
  const sessions = liveQuery(listSessions);
  const devNotes = liveQuery(listDevNotes);

  let active = $derived($sessions?.find((s) => s.status === 'active'));
  let past = $derived($sessions?.filter((s) => s.status === 'ended') ?? []);

  // Elk scherm heeft een eigen adres (#wandelingen, #wandeling/<id>,
  // #instellingen, #devnotes), zodat de terugknop van Android teruggaat naar
  // het vorige scherm in plaats van de app te sluiten. Leeg = hoofdscherm.
  let hash = $state(location.hash);
  let route = $derived(hash.replace(/^#\/?/, ''));
  const onHashChange = () => {
    hash = location.hash;
    menuOpen = false;
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', onHashChange);
  onDestroy(() => window.removeEventListener('hashchange', onHashChange));

  let opened = $derived(
    route.startsWith('wandeling/') ? past.find((s) => s.id === route.slice(10)) : undefined,
  );

  let menuOpen = $state(false);

  // Zonder toegangscode werkt de verwerking niet; dan op het hoofdscherm een
  // verwijzing naar de instellingen. De code staat in localStorage (geen
  // state), dus opnieuw lezen bij elke schermwissel.
  let hasAccessCode = $derived.by(() => {
    void route;
    return !!getAccessCode();
  });

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
</script>

<header>
  <div class="bar">
    <a class="brand" href="#/">
      <img src="/icon.svg" alt="" width="32" height="32" />
      Fluistervink
    </a>
    <button
      class="menu-button"
      aria-label="Menu"
      aria-expanded={menuOpen}
      onclick={() => (menuOpen = !menuOpen)}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
      </svg>
    </button>
    {#if menuOpen}
      <!-- Tik naast het menu = sluiten -->
      <button class="backdrop" aria-label="Menu sluiten" onclick={() => (menuOpen = false)}></button>
      <nav>
        <a href="#wandelingen">Vorige wandelingen</a>
        {#if $devNotes?.length}
          <a href="#devnotes">Dev notes ({$devNotes.length})</a>
        {/if}
        <a href="#instellingen">Instellingen</a>
      </nav>
    {/if}
  </div>
</header>

<main>
  {#if $sessions === undefined}
    <!-- Database wordt nog geladen -->
  {:else if route === 'wandelingen'}
    <PastSessions sessions={past} />
  {:else if opened}
    <PastSession session={opened} resumable={!active && opened === past[0]} />
  {:else if route === 'instellingen'}
    <Settings />
  {:else if route === 'devnotes'}
    <DevNotes />
  {:else if active}
    <section class="walk">
      <div class="walk-info">
        <h1>{active.place?.name ?? 'Wandeling'}</h1>
        <p class="muted">
          Sinds {timeFormat.format(active.startedAt)} ·
          <span class="duration">{formatDuration(now - active.startedAt)}</span>
        </p>
      </div>
      <button class="stop" onclick={stop}>Stop</button>
    </section>
    <ActiveSession session={active} />
  {:else}
    <section class="home">
      <p class="intro">
        Druk op de knop en zeg wat je ziet of hoort, bijvoorbeeld
        <em>"zes overvliegende houtduiven"</em> of <em>"roepje vink"</em>.
      </p>
      <button class="start" onclick={start}>Start wandeling</button>
      {#if !hasAccessCode}
        <p class="notice">
          Vul eerst de toegangscode in bij <a href="#instellingen">Instellingen</a>.
        </p>
      {/if}
    </section>
  {/if}
</main>

<style>
  header {
    position: sticky;
    top: 0;
    /* Boven de kaart: Leaflet gebruikt z-index tot 1000 */
    z-index: 1100;
    background: var(--brand);
    color: var(--on-brand);
  }

  .bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 32rem;
    margin: 0 auto;
    padding: 0.6rem 0.75rem 0.6rem 1rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: inherit;
    text-decoration: none;
  }

  .brand img {
    border-radius: 0.5rem;
    box-shadow: 0 0 0 2px rgb(255 255 255 / 0.35);
  }

  .menu-button {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border: none;
    border-radius: 0.5rem;
    background: none;
    color: inherit;
  }

  .menu-button:active {
    background: rgb(255 255 255 / 0.15);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    border: none;
    background: rgb(0 0 0 / 0.2);
  }

  nav {
    position: absolute;
    top: calc(100% + 0.25rem);
    right: 0.75rem;
    display: grid;
    min-width: 14rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.15);
  }

  nav a {
    padding: 1rem 1.25rem;
    color: var(--fg);
    text-decoration: none;
  }

  nav a + a {
    border-top: 1px solid var(--border);
  }

  main {
    max-width: 32rem;
    margin: 0 auto;
    padding: 0 1rem 1rem;
  }

  .home {
    display: grid;
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .intro {
    margin: 0;
    font-size: 1.1rem;
    color: var(--muted);
  }

  .notice {
    margin: 0;
  }

  .notice a {
    color: var(--green);
  }

  .start {
    width: 100%;
    padding: 2.5rem 1.5rem;
    border: none;
    border-radius: 1rem;
    font: inherit;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--on-brand);
    background: var(--brand);
  }

  .walk {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  .walk-info {
    flex: 1;
    min-width: 0;
  }

  .walk h1 {
    margin: 0;
    overflow: hidden;
    font-size: 1.5rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .walk p {
    margin: 0.15rem 0 0;
  }

  .duration {
    font-variant-numeric: tabular-nums;
  }

  /* Bewust klein en omlijnd: stoppen moet kunnen, maar niet per ongeluk */
  .stop {
    flex: none;
    padding: 0.6rem 1.1rem;
    border: 1.5px solid var(--red);
    border-radius: 2rem;
    font: inherit;
    font-weight: 600;
    color: var(--red);
    background: transparent;
  }

  .stop:active {
    color: white;
    background: var(--red);
  }

  .muted {
    color: var(--muted);
  }
</style>
