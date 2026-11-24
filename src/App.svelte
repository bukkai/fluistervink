<script lang="ts">
  import { language, t } from './lib/i18n';
  import { formatCountdown, timeFormat } from './lib/format';
  import StillBirding from './lib/StillBirding.svelte';
  import { liveQuery } from 'dexie';
  import { onDestroy, untrack } from 'svelte';
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
  import { ApiError, claimOwnInstall, getAccessCode, getTester, OWNER, ping } from './lib/api';
  import { getInstallToken } from './lib/install';
  import { listDevNotes } from './lib/devNotes';
  import { CHANNEL } from './lib/log';
  import { vibrate } from './lib/feedback';
  import { DEV_OPTION_EVENT, devOptionOn } from './lib/devOptions';
  import {
    TUINTEL_WARN_MS,
    tuintelAvailable,
    tuintelLeftMs,
    tuintelPhase,
  } from './lib/tuintelling';
  import { instance } from './lib/instance.svelte';
  import { processQueue } from './lib/queue';
  import { syncSessionService } from './lib/sessionService';
  import { LEAVE_TREKTEL_TEXT, leavesSessionScreen } from './lib/trektel';
  import { stopTrektel, trektel } from './lib/trektelRecorder.svelte';
  import { listenShortcut, setShortcut } from './lib/native';
  import {
    SHARE_CHANGED,
    scheduleShare,
    sentNoteIds,
    setShareEnabled,
    shareChoiceMade,
    shareEnabled,
  } from './lib/share';
  import { scheduleSummaries } from './lib/summaries';
  import DevNotes from './lib/DevNotes.svelte';
  import Developer from './lib/Developer.svelte';
  import Changelog from './lib/Changelog.svelte';
  import Home from './lib/Home.svelte';
  import HowItWorksEn from './lib/HowItWorks.en.svelte';
  import HowItWorksNl from './lib/HowItWorks.svelte';
  import PastSession from './lib/PastSession.svelte';
  import PastSessions from './lib/PastSessions.svelte';
  import PrivacyEn from './lib/Privacy.en.svelte';
  import PrivacyNl from './lib/Privacy.svelte';
  import Settings from './lib/Settings.svelte';
  import Statistics from './lib/Statistics.svelte';
  import Welcome from './lib/Welcome.svelte';
  import { setWelcomeDone, welcomeDone } from './lib/welcome';
  import Zeemeeuwen from './lib/Zeemeeuwen.svelte';
  import TochEenBuizerd from './lib/TochEenBuizerd.svelte';
  import Lifer from './lib/Lifer.svelte';
  import UpdateStatus from './lib/UpdateStatus.svelte';

  // Uitspraken die bij het afsluiten nog niet verwerkt waren, alsnog verwerken.
  // Dit exemplaar neemt de wachtrij over van een eventueel ander (tabblad).
  processQueue({ takeOver: true });

  // Sessies en feedback delen met de ontwikkelaar (share.ts): bij het
  // opstarten, bij elke schermwissel (bv. klaar met nalopen) en bij weer online
  scheduleShare();
  scheduleSummaries();
  window.addEventListener('online', () => {
    scheduleShare();
    scheduleSummaries();
  });

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

  // Android-app: melding zolang er een sessie loopt, zodat
  // de app met het scherm uit doorwerkt (sessionService.ts). Pas na het laden.
  let activeId = $derived($sessions ? (active?.id ?? null) : undefined);
  $effect(() => {
    if (activeId !== undefined) syncSessionService(activeId ?? undefined);
  });

  // Elk scherm heeft een eigen adres (#sessies, #sessie/<id>,
  // #instellingen, #feedback), zodat de terugknop van Android teruggaat naar
  // het vorige scherm in plaats van de app te sluiten. Leeg = hoofdscherm.
  let hash = $state(location.hash);
  // Oude adressen (#wandelingen, #wandeling/<id>, van vóór november 2026) werken nog
  let route = $derived(
    hash
      .replace(/^#\/?/, '')
      .replace(/^wandeling(en)?\b/, (m) => (m === 'wandeling' ? 'sessie' : 'sessies')),
  );
  const onHashChange = () => {
    hash = location.hash;
    scheduleShare();
    scheduleSummaries();
    // De bevestiging na het stoppen alleen tonen tot je dat scherm verlaat
    if (justStopped && !hash.endsWith(justStopped)) justStopped = undefined;
    menuOpen = false;
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', onHashChange);
  onDestroy(() => window.removeEventListener('hashchange', onHashChange));

  // Een trektelling loopt alleen op het hoofdscherm: elk ander scherm zet de
  // microfoon uit (feedback 17 nov: naar Instellingen en de telling was weg).
  // Daarom eerst vragen, bij elke link in de app (menu, kaartjes, tips).
  const guardTrektel = (event: MouseEvent) => {
    if (trektel.status === 'idle') return;
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link || !leavesSessionScreen(link.getAttribute('href'))) return;
    if (confirm(LEAVE_TREKTEL_TEXT)) return;
    event.preventDefault();
    menuOpen = false;
  };
  document.addEventListener('click', guardTrektel, true);
  onDestroy(() => document.removeEventListener('click', guardTrektel, true));

  let opened = $derived(
    route.startsWith('sessie/')
      ? past.find((s) => s.id === route.slice('sessie/'.length))
      : undefined,
  );

  let menuOpen = $state(false);

  // Zonder toegangscode (alleen de eigenaar heeft er een) meldt de app zich
  // meteen aan als installatie
  // (install.ts), zodat een eventuele controle van Cloudflare nu op het
  // hoofdscherm komt en niet midden in de eerste uitspraak. Geen verbinding:
  // dan bij het eerste verzoek opnieuw, zonder melding.
  let installProblem = $state<string>();
  async function ensureAccess() {
    // De eigenaar: een installatie van vóór de code als de zijne melden (api.ts)
    if (getAccessCode()) return claimOwnInstall();
    if (getInstallToken()) return;
    try {
      await ping();
    } catch (error) {
      if (error instanceof ApiError && error.status !== 0) installProblem = error.message;
    }
  }
  ensureAccess();

  // Het scherm Developer (export, import) alleen voor de eigenaar. De naam komt
  // van de proxy (ping); in localStorage, dus opnieuw lezen per scherm.
  let isOwner = $derived.by(() => {
    void route;
    void installProblem;
    return getTester() === OWNER;
  });

  // Delen met de ontwikkelaar pas na toestemming (share.ts). Zolang er niet
  // gekozen is, vraagt het hoofdscherm het; ook aan wie de app al had.
  let askShare = $state(!shareChoiceMade());
  function chooseShare(on: boolean) {
    setShareEnabled(on);
    askShare = false;
  }

  // Klok voor de looptijd van de lopende sessie en de herinnering op het startscherm
  let now = $state(Date.now());
  const timer = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(timer));

  // Welkom voor nieuwelingen (welcome.ts): pas als duidelijk is dat er nog
  // geen enkele sessie is, zodat het niet even opflitst bij wie al sessies heeft.
  // Het welkom vervangt het hoofdscherm en stelt ook de vraag over delen.
  let welcomeClosed = $state(welcomeDone());
  let showWelcome = $derived($sessions?.length === 0 && !welcomeClosed);

  async function start(options: { tuintelling?: boolean } = {}) {
    setWelcomeDone();
    welcomeClosed = true;
    await startSession(options);
    requestPersistentStorage();
  }

  // Snelkoppeling "Begin met vogelen" op het app-pictogram, voor iedereen.
  // Tikken: naar het hoofdscherm en een sessie starten (startSession doet
  // niets als er al een loopt).
  setShortcut(true);
  listenShortcut((action) => {
    if (action !== 'begin') return;
    location.hash = '';
    start();
  });

  // Vergeten sessie (sessions.ts): bij het openen van de app, en bij
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
    if (activeId) syncSessionService(activeId);
  };
  document.addEventListener('visibilitychange', onVisible);
  onDestroy(() => document.removeEventListener('visibilitychange', onVisible));

  let askStillBirding = $derived(
    stale?.kind === 'ask' && stale.session.id === active?.id ? stale : undefined,
  );

  async function keepBirding() {
    if (!askStillBirding) return;
    await keepSession(askStillBirding.session.id);
    stale = undefined;
  }

  /** Vergeten te stoppen: eindtijd is de laatste uitspraak, niet nu */
  async function stopForgotten() {
    if (!askStillBirding) return;
    const { session, lastActivityAt } = askStillBirding;
    stale = undefined;
    await stopSession(session.id, lastActivityAt);
    justStopped = session.id;
    location.hash = `sessie/${session.id}`;
  }

  /** Net gestopte sessie, voor de bevestiging "opgeslagen" */
  let justStopped = $state<string>();

  // Tuintelling (ontwikkeloptie, tuintelling.ts): een half uur vanaf het
  // begin van het tellen, met een tril bij nog vijf minuten; daarna stopt de
  // telling en de sessie vanzelf. Staat de app op de achtergrond en loopt de
  // klok niet, dan gebeurt het bij terugkomen, met als eindtijd het eind van
  // het half uur. Wie na afloop nog iets inspreekt ("nog iets vergeten?"),
  // zet de sessie voort: dan geen klok en niet opnieuw stoppen.
  let tuintelOn = $state(devOptionOn('tuintelling'));
  $effect(() => {
    const update = () => (tuintelOn = devOptionOn('tuintelling'));
    window.addEventListener(DEV_OPTION_EVENT, update);
    return () => window.removeEventListener(DEV_OPTION_EVENT, update);
  });
  // Met de ontwikkeloptie altijd, voor iedereen alleen rond het telweekend
  let tuintelCan = $derived(tuintelAvailable(now, tuintelOn));
  let tuintelPhaseNow = $derived(active ? tuintelPhase(active, now) : undefined);
  let tuintelLeftRaw = $derived(active ? tuintelLeftMs(active, now) : undefined);
  let tuintelOver = $derived(
    active !== undefined &&
      tuintelLeftRaw !== undefined &&
      tuintelLeftRaw <= 0 &&
      now + tuintelLeftRaw > (active.resumedAt ?? active.startedAt),
  );
  /** Klok in de kop, alleen zolang het half uur loopt */
  let tuintelLeft = $derived(
    tuintelLeftRaw !== undefined && tuintelLeftRaw > 0 ? tuintelLeftRaw : undefined,
  );
  /** Voor welke sessie al getrild/gestopt is, zodat het één keer gebeurt */
  let tuintelWarned = '';
  let tuintelStopped = '';
  $effect(() => {
    if (!active || tuintelLeftRaw === undefined) return;
    const id = active.id;
    if (tuintelOver && tuintelStopped !== id) {
      tuintelStopped = id;
      const endedAt = now + tuintelLeftRaw;
      untrack(() => finishTuintel(id, endedAt));
    } else if (
      tuintelLeft !== undefined &&
      tuintelLeft <= TUINTEL_WARN_MS &&
      tuintelWarned !== id
    ) {
      tuintelWarned = id;
      vibrate('tuintelBijna');
    }
  });

  async function finishTuintel(id: string, endedAt: number) {
    // Eerst de microfoon uit: het laatste stuk gaat nog gewoon de wachtrij in
    stopTrektel();
    await stopSession(id, endedAt);
    justStopped = id;
    vibrate('tuintelKlaar');
    location.hash = `sessie/${id}`;
  }

  /** Na het stoppen meteen naar het nalopen van de sessie */
  async function stop() {
    // Na een tuintelling nog iets ingesproken: "Klaar" zonder vraag, terug naar het resultaat
    if (!active || (tuintelPhaseNow !== 'after' && !confirm(t('app.confirmStop')))) return;
    const id = active.id;
    await stopSession(id);
    justStopped = id;
    vibrate('saved');
    location.hash = `sessie/${id}`;
  }
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
      aria-label={t('menu.open')}
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
      <button class="backdrop" aria-label={t('menu.close')} onclick={() => (menuOpen = false)}
      ></button>
      <nav>
        <a href="#sessies">{t('menu.sessions')}</a>
        <a href="#uitleg">{t('menu.howItWorks')}</a>
        <a href="#feedback">
          {unsentNotes ? t('menu.feedbackUnsent', { n: unsentNotes }) : t('menu.feedback')}
        </a>
        <a href="#instellingen">{t('menu.settings')}</a>
        <a href="#privacy">{t('menu.privacy')}</a>
        {#if isOwner}
          <a href="#statistieken">Statistieken</a>
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
      <h1>{t('app.dormantTitle')}</h1>
      <p class="intro">{t('app.dormantText')}</p>
      <button class="start" onclick={() => location.reload()}>{t('app.dormantContinue')}</button>
    </section>
  {:else if $sessions === undefined}
    <!-- Database wordt nog geladen -->
  {:else if route === 'sessies'}
    <PastSessions sessions={past} />
  {:else if opened}
    <PastSession
      session={opened}
      resumable={!active && opened === past[0]}
      justSaved={opened.id === justStopped}
    />
  {:else if route === 'instellingen'}
    <Settings />
  {:else if route === 'nieuw'}
    <Changelog />
  {:else if route === 'uitleg'}
    {#if language === 'en'}<HowItWorksEn />{:else}<HowItWorksNl />{/if}
  {:else if route === 'privacy'}
    {#if language === 'en'}<PrivacyEn />{:else}<PrivacyNl />{/if}
  {:else if route === 'statistieken' && isOwner}
    <Statistics />
  {:else if route === 'developer' && isOwner}
    <Developer />
  {:else if route === 'feedback' || route === 'devnotes'}
    <DevNotes />
  {:else if active}
    <section class="session-head">
      <div class="session-info">
        <h1>{active.place?.name ?? t('common.defaultSessionName')}</h1>
        <p class="muted">
          {#if tuintelLeft !== undefined}
            {t('app.tuintelLeft', { time: formatCountdown(tuintelLeft) })}
          {:else if tuintelPhaseNow === 'before'}
            {t('app.tuintelBefore')}
          {:else if tuintelPhaseNow === 'after'}
            {t('app.tuintelAfter')}
          {:else}
            {t('app.since', { time: timeFormat.format(active.startedAt) })} ·
            <span class="duration">{formatDuration(now - active.startedAt)}</span>
          {/if}
        </p>
      </div>
      <button class="stop" onclick={stop}>
        {tuintelPhaseNow === 'after' ? t('app.tuintelDone') : t('app.stop')}
      </button>
    </section>
    {#if askStillBirding}
      <StillBirding
        lastActivityAt={askStillBirding.lastActivityAt}
        onkeep={keepBirding}
        onstop={stopForgotten}
      />
    {/if}
    <ActiveSession session={active} />
  {:else if showWelcome}
    <Welcome
      askShare={askShare && !installProblem}
      onshare={chooseShare}
      onclose={() => (welcomeClosed = true)}
      ontuintel={tuintelCan ? () => start({ tuintelling: true }) : undefined}
    />
  {:else}
    <Home
      sessions={$sessions}
      {now}
      {installProblem}
      {isOwner}
      {stale}
      ondismissstale={() => (stale = undefined)}
      {askShare}
      onshare={chooseShare}
      onstart={() => start()}
      onstarttuintel={tuintelCan ? () => start({ tuintelling: true }) : undefined}
    />
  {/if}
</main>

<UpdateStatus hidden={!!active} />

<Zeemeeuwen />
<TochEenBuizerd />
<Lifer />

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

  .session-head {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  .session-info {
    flex: 1;
    min-width: 0;
  }

  .session-head h1 {
    margin: 0;
    overflow: hidden;
    font-size: 1.5rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-head p {
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
