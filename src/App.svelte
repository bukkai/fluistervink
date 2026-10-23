<script lang="ts">
  import { liveQuery } from 'dexie';
  import { onDestroy } from 'svelte';
  import {
    checkStaleSession,
    formatDuration,
    keepSession,
    listSessions,
    requestPersistentStorage,
    startSession,
    stopSession,
    type StaleCheck,
  } from './lib/sessions';
  import ActiveSession from './lib/ActiveSession.svelte';
  import { getAccessCode, getTester, ping, takeInvite } from './lib/api';
  import { listDevNotes } from './lib/devNotes';
  import { CHANNEL } from './lib/log';
  import { vibrate } from './lib/feedback';
  import { instance } from './lib/instance.svelte';
  import { processQueue } from './lib/observations';
  import { syncWalkService } from './lib/walkService';
  import {
    SHARE_CHANGED,
    scheduleShare,
    sentNoteIds,
    setShareEnabled,
    shareChoiceMade,
    shareEnabled,
  } from './lib/share';
  import DevNotes from './lib/DevNotes.svelte';
  import Developer from './lib/Developer.svelte';
  import HowItWorks from './lib/HowItWorks.svelte';
  import PastSession from './lib/PastSession.svelte';
  import PastSessions from './lib/PastSessions.svelte';
  import Privacy from './lib/Privacy.svelte';
  import Settings from './lib/Settings.svelte';
  import Zeemeeuwen from './lib/Zeemeeuwen.svelte';

  // Uitspraken die bij het afsluiten nog niet verwerkt waren, alsnog verwerken.
  // Dit exemplaar neemt de wachtrij over van een eventueel ander (tabblad).
  processQueue({ takeOver: true });

  // Wandelingen en feedback delen met de ontwikkelaar (share.ts): bij het
  // opstarten, bij elke schermwissel (bv. klaar met nalopen) en bij weer online
  scheduleShare();
  window.addEventListener('online', () => scheduleShare());

  // liveQuery draait opnieuw zodra de data in IndexedDB verandert, en is
  // direct bruikbaar als Svelte-store ($sessions).
  const sessions = liveQuery(listSessions);
  const devNotes = liveQuery(listDevNotes);

  // Teller bij Feedback: alleen wat nog niet verstuurd is (zoals het
  // Feedback-scherm). Opnieuw lezen na elke ronde en bij delen aan/uit.
  let sharing = $state(shareEnabled());
  let sentNotes = $state(sentNoteIds());
  const onShareChanged = () => {
    sharing = shareEnabled();
    sentNotes = sentNoteIds();
  };
  window.addEventListener(SHARE_CHANGED, onShareChanged);
  onDestroy(() => window.removeEventListener(SHARE_CHANGED, onShareChanged));
  let unsentNotes = $derived(
    sharing
      ? ($devNotes ?? []).filter((n) => !sentNotes.has(n.id)).length
      : ($devNotes?.length ?? 0),
  );

  let active = $derived($sessions?.find((s) => s.status === 'active'));
  let past = $derived($sessions?.filter((s) => s.status === 'ended') ?? []);

  // Android-app: melding "Wandeling loopt" zolang er een wandeling loopt, zodat
  // de app met het scherm uit doorwerkt (walkService.ts). Pas na het laden.
  let activeId = $derived($sessions ? (active?.id ?? null) : undefined);
  $effect(() => {
    if (activeId !== undefined) syncWalkService(activeId ?? undefined);
  });

  // Elk scherm heeft een eigen adres (#wandelingen, #wandeling/<id>,
  // #instellingen, #feedback), zodat de terugknop van Android teruggaat naar
  // het vorige scherm in plaats van de app te sluiten. Leeg = hoofdscherm.
  let hash = $state(location.hash);
  let route = $derived(hash.replace(/^#\/?/, ''));
  const onHashChange = () => {
    hash = location.hash;
    checkInvite();
    scheduleShare();
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
    void welcome;
    return !!getAccessCode();
  });

  // Het scherm Developer (export, import) alleen voor de eigenaar. De naam komt
  // van de proxy (ping), net als hasAccessCode opnieuw lezen per scherm.
  let isOwner = $derived.by(() => {
    void route;
    void welcome;
    return getTester() === 'eigenaar';
  });

  // Net geopend via een uitnodigingslink: meteen testen of de code werkt en
  // welkom heten op het hoofdscherm. Ook bij hashchange, voor als de app al
  // open stond (main.ts heeft de code dan net bewaard).
  let welcome = $state<{ ok: boolean; tester?: string }>();
  async function checkInvite() {
    if (!takeInvite()) return;
    try {
      welcome = { ok: true, tester: await ping() };
    } catch {
      welcome = { ok: false };
    }
  }
  checkInvite();

  // Delen met de ontwikkelaar pas na toestemming (share.ts). Zolang er niet
  // gekozen is, vraagt het hoofdscherm het; ook aan wie de app al had.
  let askShare = $state(!shareChoiceMade());
  function chooseShare(on: boolean) {
    setShareEnabled(on);
    askShare = false;
  }

  // Klok voor de looptijd van de lopende wandeling
  let now = $state(Date.now());
  const timer = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(timer));

  async function start() {
    await startSession();
    requestPersistentStorage();
  }

  // Vergeten wandeling (sessions.ts): bij het openen van de app, en bij
  // terugkomen uit de achtergrond (Android sluit de app niet altijd)
  let stale = $state<StaleCheck>();
  async function checkStale() {
    const result = await checkStaleSession();
    if (result) stale = result;
    // Gestopt = klaar om te delen
    if (result?.kind === 'stopped') scheduleShare();
  }
  checkStale();
  const onVisible = () => {
    if (document.hidden) return;
    checkStale();
    // Android kan de service intussen gestopt hebben
    if (activeId) syncWalkService(activeId);
  };
  document.addEventListener('visibilitychange', onVisible);
  onDestroy(() => document.removeEventListener('visibilitychange', onVisible));

  let askStillWalking = $derived(
    stale?.kind === 'ask' && stale.session.id === active?.id ? stale : undefined,
  );

  async function keepWalking() {
    if (!askStillWalking) return;
    await keepSession(askStillWalking.session.id);
    stale = undefined;
  }

  /** Vergeten te stoppen: eindtijd is de laatste uitspraak, niet nu */
  async function stopForgotten() {
    if (!askStillWalking) return;
    const { session, lastActivityAt } = askStillWalking;
    stale = undefined;
    await stopSession(session.id, lastActivityAt);
    justStopped = session.id;
    location.hash = `wandeling/${session.id}`;
  }

  /** "vandaag 14:32" of "ma 12 okt 14:32" */
  function formatMoment(at: number): string {
    const day =
      new Date(at).toDateString() === new Date().toDateString() ? 'vandaag' : dateFormat.format(at);
    return `${day} ${timeFormat.format(at)}`;
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
  const dateFormat = new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
</script>

<header>
  <div class="bar">
    <a class="brand" href="#/">
      <img src="/icon.svg" alt="" width="32" height="32" />
      Fluistervink
      {#if CHANNEL === 'beta'}<span class="channel">beta</span>{/if}
    </a>
    <button
      class="menu-button"
      aria-label="Menu"
      aria-expanded={menuOpen}
      onclick={() => (menuOpen = !menuOpen)}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          stroke-width="2.25"
          stroke-linecap="round"
        />
      </svg>
    </button>
    {#if menuOpen}
      <!-- Tik naast het menu = sluiten -->
      <button class="backdrop" aria-label="Menu sluiten" onclick={() => (menuOpen = false)}
      ></button>
      <nav>
        <a href="#wandelingen">Vorige wandelingen</a>
        <a href="#uitleg">Hoe werkt het?</a>
        <a href="#feedback">Feedback{unsentNotes ? ` (${unsentNotes})` : ''}</a>
        <a href="#instellingen">Instellingen</a>
        <a href="#privacy">Privacy</a>
        {#if isOwner}
          <a href="#developer">Developer</a>
        {/if}
      </nav>
    {/if}
  </div>
</header>

<main>
  {#if instance.dormant}
    <!-- Overgenomen door een ander exemplaar (tabblad of geïnstalleerde app) -->
    <section class="home">
      <h1>Fluistervink is in een ander venster geopend</h1>
      <p class="intro">Gebruik de app op één plek tegelijk, anders zitten ze elkaar in de weg.</p>
      <button class="start" onclick={() => location.reload()}>Hier verder</button>
    </section>
  {:else if $sessions === undefined}
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
  {:else if route === 'uitleg'}
    <HowItWorks />
  {:else if route === 'privacy'}
    <Privacy />
  {:else if route === 'developer' && isOwner}
    <Developer />
  {:else if route === 'feedback' || route === 'devnotes'}
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
    {#if askStillWalking}
      <div class="still-walking card">
        <strong>Loopt deze wandeling nog?</strong>
        <p>Sinds {formatMoment(askStillWalking.lastActivityAt)} is er niets ingesproken.</p>
        <div class="buttons">
          <button class="btn" onclick={keepWalking}>Ja, ga door</button>
          <button class="btn secondary" onclick={stopForgotten}>Nee, stoppen</button>
        </div>
      </div>
    {/if}
    <ActiveSession session={active} />
  {:else}
    <section class="home">
      <img class="hero" src="/icon.svg" alt="" width="112" height="112" />
      <h1>Klaar om te gaan vogelen?</h1>
      <p class="intro">
        Druk tijdens de wandeling op de knop en zeg wat je ziet of hoort, bijvoorbeeld
        <em>"zes overvliegende houtduiven"</em> of <em>"roepje vink"</em>.
      </p>
      {#if welcome?.ok}
        <p class="welcome">
          Welkom{welcome.tester ? `, ${welcome.tester}` : ''}! Je toegang is ingesteld. Tip: zet de
          app op je startscherm via het menu van Chrome → <em>Toevoegen aan startscherm</em>. Lees
          ook even <a href="#uitleg">hoe het werkt</a>.
          <button class="link" onclick={() => (welcome = undefined)}>Oké</button>
        </p>
      {:else if welcome}
        <p class="notice">
          De code uit de uitnodigingslink werkt niet (of er is geen verbinding). Kijk bij
          <a href="#instellingen">Instellingen</a>.
        </p>
      {:else if !hasAccessCode}
        <p class="notice">
          Vul eerst de toegangscode in bij <a href="#instellingen">Instellingen</a>.
        </p>
      {/if}
      {#if stale?.kind === 'stopped'}
        <p class="welcome">
          Je wandeling van {formatMoment(stale.session.startedAt)} stond nog aan. Na 8 uur zonder uitspraken
          is hij vanzelf gestopt.
          <a href="#wandeling/{stale.session.id}">Bekijken</a> ·
          <button class="link" onclick={() => (stale = undefined)}>Oké</button>
        </p>
      {/if}
      {#if hasAccessCode && askShare}
        <div class="consent card">
          <strong>Delen met de ontwikkelaar?</strong>
          <p>
            Fluistervink is nog in ontwikkeling. Mag de app na elke wandeling je uitspraken (als
            tekst), wat de app ervan maakte, je correcties en feedback, en de locaties van je
            waarnemingen naar de ontwikkelaar sturen? Opnames niet, tenzij je dat bij Feedback
            aanzet. Alleen de ontwikkelaar kan het lezen; je kunt het altijd weer uitzetten.
            <a href="#privacy">Meer over privacy</a>
          </p>
          <div class="consent-buttons">
            <button class="btn" onclick={() => chooseShare(true)}>Ja, delen</button>
            <button class="btn secondary" onclick={() => chooseShare(false)}>Liever niet</button>
          </div>
        </div>
      {/if}
      <button class="start" onclick={start}>Start wandeling</button>
      {#if past[0]}
        <a class="last card" href="#wandeling/{past[0].id}">
          <span>
            <span class="muted">Laatste wandeling</span><br />
            <strong>{past[0].place?.name ?? 'Wandeling'}</strong>
            <span class="muted">· {dateFormat.format(past[0].startedAt)}</span>
          </span>
          <span class="chevron" aria-hidden="true">›</span>
        </a>
      {/if}
    </section>
  {/if}
</main>

<Zeemeeuwen />

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

  /* Alleen in de beta: zo zie je meteen welke versie je open hebt */
  .channel {
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--breast-strong);
    color: #ffffff;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
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
    justify-items: center;
    gap: 1rem;
    margin-top: 2rem;
    text-align: center;
  }

  .hero {
    border-radius: 1.75rem;
    box-shadow: 0 8px 24px rgb(60 55 50 / 0.18);
  }

  .home h1 {
    margin: 0.5rem 0 0;
    font-size: 1.6rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .intro {
    margin: 0;
    max-width: 24rem;
    font-size: 1.05rem;
    color: var(--muted);
  }

  .notice {
    margin: 0;
    padding: 0.5rem 0.9rem;
    border-radius: var(--radius);
    color: var(--amber);
    background: var(--amber-soft);
  }

  .notice a {
    color: inherit;
    font-weight: 600;
  }

  .welcome {
    margin: 0;
    padding: 0.5rem 0.9rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .consent {
    display: grid;
    gap: 0.5rem;
    box-sizing: border-box;
    width: 100%;
    padding: 0.9rem 1rem;
    text-align: left;
  }

  .consent p {
    margin: 0;
  }

  .consent a {
    color: inherit;
  }

  .consent-buttons,
  .still-walking .buttons {
    display: flex;
    gap: 0.5rem;
  }

  .still-walking {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.9rem 1rem;
  }

  .still-walking p {
    margin: 0;
  }

  .last {
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    width: 100%;
    margin-top: 0;
    padding: 0.75rem 1rem;
    text-align: left;
    color: inherit;
    text-decoration: none;
  }

  .chevron {
    font-size: 1.5rem;
    color: var(--muted);
  }

  .start {
    width: 100%;
    margin-top: 0.5rem;
    padding: 2.25rem 1.5rem;
    border: none;
    border-radius: 1rem;
    font: inherit;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--on-brand);
    background: var(--brand);
    box-shadow:
      0 2px 0 var(--brand-strong),
      0 6px 16px rgb(60 55 50 / 0.18);
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
    /* Klein, maar wel 48 px hoog: ook met handschoenen te raken */
    box-sizing: border-box;
    min-height: 3rem;
    padding: 0.6rem 1.25rem;
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
</style>
