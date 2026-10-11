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
  import { vibrate } from './lib/feedback';
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
    // De bevestiging na het stoppen alleen tonen tot je dat scherm verlaat
    if (justStopped && !hash.endsWith(justStopped)) justStopped = undefined;
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

  /** Net gestopte wandeling, voor de bevestiging "opgeslagen" */
  let justStopped = $state<string>();

  /** Na het stoppen meteen naar het nalopen van de wandeling */
  async function stop() {
    if (!active || !confirm('Wandeling stoppen?')) return;
    const id = active.id;
    await stopSession(id);
    justStopped = id;
    vibrate('saved');
    location.hash = `wandeling/${id}`;
  }

  const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });
</script>

<header>
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
    ☰
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
</header>

<main>
  {#if $sessions === undefined}
    <!-- Database wordt nog geladen -->
  {:else if route === 'wandelingen'}
    <PastSessions sessions={past} />
  {:else if opened}
    <PastSession
      session={opened}
      resumable={!active && opened === past[0]}
      justSaved={opened.id === justStopped}
    />
  {:else if route === 'instellingen'}
    <Settings />
  {:else if route === 'devnotes'}
    <DevNotes />
  {:else if active}
    <section class="active">
      <p>
        Wandeling bezig sinds {timeFormat.format(active.startedAt)}
        <span class="muted">({formatDuration(now - active.startedAt)})</span>
        {#if active.place}<br /><span class="muted">{active.place.name}</span>{/if}
      </p>
      <button class="stop" onclick={stop}>Stop wandeling</button>
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 32rem;
    margin: 0 auto;
    padding: 0.75rem 1rem;
    background: var(--bg);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1.4rem;
    font-weight: 700;
    color: inherit;
    text-decoration: none;
  }

  .brand img {
    border-radius: 0.5rem;
  }

  .menu-button {
    width: 2.75rem;
    height: 2.75rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 1.5rem;
    background: none;
    color: inherit;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    border: none;
    background: rgb(0 0 0 / 0.2);
  }

  nav {
    position: absolute;
    top: 100%;
    right: 1rem;
    display: grid;
    min-width: 14rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--bg);
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.15);
  }

  nav a {
    padding: 1rem 1.25rem;
    color: inherit;
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

  .start,
  .stop {
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
    padding: 2.5rem 1.5rem;
    background: var(--green);
  }

  .stop {
    background: var(--red);
  }

  .muted {
    color: var(--muted);
  }
</style>
