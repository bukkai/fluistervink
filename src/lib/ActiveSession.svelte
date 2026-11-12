<script lang="ts">
  import { untrack } from 'svelte';
  import { nameFromStart } from './area';
  import type { PositionLookup, Session } from './db';
  import { vibrate } from './feedback';
  import { logEvent } from './log';
  import { listenVolumeKey, volumeKeySupported } from './native';
  import { recordFix } from './effort';
  import { currentPosition, gps, startTracking, stopTracking } from './location.svelte';
  import { onAudioLimit, submitRecording, submitText } from './observations';
  import { recorder, startRecording, stopRecording } from './recorder.svelte';
  import SessionLog from './SessionLog.svelte';
  import { syncSessionService } from './sessionService';
  import { createTalkButton } from './talkButton';
  import { trektelEnabled } from './trektel';
  import { startTrektel, stopTrektel, trektel, trektelSupported } from './trektelRecorder.svelte';
  import { volumeKeyEnabled } from './volumeKey';

  let { session }: { session: Session } = $props();

  let text = $state('');
  /** Typen: dan staat het toetsenbord waar de knop zit */
  let typing = $state(false);
  /** Ruimte onder de lijst, zodat de knop de laatste waarneming niet bedekt */
  let barHeight = $state(0);
  let input = $state<HTMLInputElement>();

  // Toetsenbord dicht (terugknop of -veeg op Android) zonder dat het veld zijn
  // focus verliest: dan zou de knop weg blijven. Het zichtbare deel van het
  // scherm wordt dan flink hoger; laat het veld dan los.
  $effect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let height = viewport.height;
    function onResize() {
      const grew = viewport!.height - height > 100;
      height = viewport!.height;
      if (grew && document.activeElement === input) input?.blur();
    }
    viewport.addEventListener('resize', onResize);
    return () => viewport.removeEventListener('resize', onResize);
  });

  // GPS aan zolang dit scherm (de lopende sessie) zichtbaar is
  $effect(() => {
    startTracking();
    return () => {
      stopTracking();
      // Sessie gestopt tijdens een opname: microfoon uit, opname bewaren
      if (recorder.status === 'recording') finishRecording();
      stopTrektel();
    };
  });

  // Afgelegde afstand: elke GPS-meting gaat naar de teller (effort.ts). Bij
  // het verlaten van dit scherm een telling in het log, om de drempels te
  // kunnen bijstellen.
  // Het id zonder afhankelijkheid: de sessie verandert bij elke getelde stap.
  const fixCounts: Record<string, number> = {};
  $effect(() => {
    const fix = gps.latest;
    if (!fix) return;
    recordFix(
      untrack(() => session.id),
      $state.snapshot(fix),
    ).then((kind) => {
      if (kind) fixCounts[kind] = (fixCounts[kind] ?? 0) + 1;
    });
  });
  $effect(() => {
    const sessionId = untrack(() => session.id);
    return () => {
      if (Object.keys(fixCounts).length) logEvent('distance_fixes', fixCounts, { sessionId });
    };
  });

  // Voorlopige naam van de sessie uit de startpositie. Niet bij voortzetten.
  let naming = false;
  $effect(() => {
    if (session.place || naming) return;
    naming = true;
    const sessionId = session.id;
    currentPosition().then(({ position }) => {
      if (position) nameFromStart(sessionId, position);
    });
  });

  // Naar een andere app (Merlin) of scherm uit tijdens een opname: stoppen en
  // bewaren wat er is. Anders houdt de app de microfoon vast zonder iets op te
  // nemen, en blijft de knop op "Stop" staan.
  $effect(() => {
    function onHidden() {
      if (!document.hidden || recorder.status !== 'recording') return;
      logEvent('recording_stopped_hidden', undefined, { sessionId: session.id });
      finishRecording();
    }
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  });

  /**
   * Vergeten te stoppen: na drie minuten stopt de opname vanzelf. Lang genoeg
   * voor een hele lijst in een vogelhut of bij het trektellen (een minuut was
   * te kort, 28 okt); bij 32 kbit/s is dat ±0,7 MB.
   */
  const MAX_RECORDING_MS = 3 * 60_000;

  let lookup: Promise<PositionLookup> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let elapsed = $state(0);

  // Tikken of vasthouden, bestand tegen haperend contact (handschoenen)
  const talk = createTalkButton({
    status: () => recorder.status,
    start: async () => {
      // Tijd en positie horen bij het begin van de opname, niet bij het eind
      lookup = currentPosition();
      // Lukte de service bij de start nog niet (geen locatietoestemming), dan nu
      syncSessionService(session.id);
      if (!(await startRecording())) {
        // Niet stil mislukken: wie niet naar het scherm kijkt, denkt anders dat hij opneemt
        if (recorder.failed) vibrate('failed');
        return false;
      }
      vibrate('recording');
      maxTimer = setTimeout(finishRecording, MAX_RECORDING_MS);
      return true;
    },
    finish: finishRecording,
    log: (type, data) => logEvent(type, data, { sessionId: session.id }),
  });

  // Volumeknop als inspreekknop (Android-app, instelling): elke druk is een
  // tik op de knop. Niet tijdens een trektelling: die heeft een eigen knop.
  const volumeKeyOn = volumeKeySupported && volumeKeyEnabled();
  $effect(() => {
    if (!volumeKeyOn || trektel.status !== 'idle') return;
    return listenVolumeKey((key) => {
      logEvent('talk_volume_key', { key, status: recorder.status }, { sessionId: session.id });
      talk.tap();
    });
  });

  function press(event: PointerEvent) {
    // Een tweede vinger of de muis met een andere knop telt niet
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    // Loslaten telt ook als de vinger van de knop afglijdt
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    talk.down();
  }

  function release(event: PointerEvent) {
    if (event.isPrimary) talk.up();
  }

  function cancel(event: PointerEvent) {
    if (event.isPrimary) talk.cancel();
  }

  async function finishRecording() {
    clearTimeout(maxTimer);
    const recording = await stopRecording();
    if (!recording || !lookup) return;
    // Niet als de opname stopte omdat de app naar de achtergrond ging
    if (!document.hidden) vibrate('recorded');
    await submitRecording(session.id, recording, lookup);
  }

  // Lopende tijd tijdens de opname
  $effect(() => {
    if (recorder.status !== 'recording') return;
    const timer = setInterval(() => (elapsed = Date.now() - (recorder.startedAt ?? 0)), 200);
    return () => {
      clearInterval(timer);
      elapsed = 0;
    };
  });

  // Trektelmodus (docs/plan-trektelmodus.md): alleen als hij bij Instellingen aanstaat
  const trektelOn = trektelEnabled() && trektelSupported();

  async function beginTrektel() {
    if (recorder.status !== 'idle') return;
    syncSessionService(session.id);
    const sessionId = session.id;
    const started = await startTrektel({
      onChunkStart: () => currentPosition(),
      onChunk: (recording, chunkLookup) =>
        submitRecording(sessionId, recording, chunkLookup, { trektel: true }),
      onStopped: () => vibrate('trektelStopped'),
      onPaused: () => vibrate('trektelPaused'),
      onResumed: () => vibrate('recording'),
    });
    if (started) vibrate('recording');
  }

  // Plafond per dag bereikt (5 uur spraak, proxy): de trektelling stoppen in
  // plaats van stukken op te nemen die vandaag niet meer verwerkt worden
  $effect(() =>
    onAudioLimit(() => {
      if (trektel.status === 'idle') return;
      stopTrektel('limit');
      trektel.error =
        'Trektelling gestopt: vandaag is er al 5 uur ingesproken, het maximum per dag. De stukken blijven bewaard; tik morgen op Opnieuw om ze te laten verwerken.';
    }),
  );

  function endTrektel() {
    stopTrektel();
    vibrate('recorded');
  }

  // Lopende tijd van de trektelling (minuten en seconden)
  let trektelElapsed = $state(0);
  $effect(() => {
    if (trektel.startedAt === undefined) return;
    const timer = setInterval(
      () => (trektelElapsed = Date.now() - (trektel.startedAt ?? Date.now())),
      1000,
    );
    return () => {
      clearInterval(timer);
      trektelElapsed = 0;
    };
  });

  function clock(ms: number): string {
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const mm = String(Math.floor((total % 3600) / 60)).padStart(hours ? 2 : 1, '0');
    const ss = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  // Alleen een regel onder de knop als er iets mis is: "tik of houd vast" staat
  // in het welkom en #uitleg, en de knop zelf zegt al "Stop · 3 s". Zo kost de
  // balk geen ruimte en springt hij niet bij elke opname.
  const micMessage = $derived(
    recorder.status === 'denied'
      ? 'Geen toegang tot de microfoon. Sta dit toe in de browserinstellingen.'
      : recorder.status === 'unsupported'
        ? 'Opnemen kan niet in deze browser.'
        : recorder.failed && recorder.status === 'idle'
          ? 'De microfoon ging niet aan. Tik nog eens.'
          : undefined,
  );

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
    // Toetsenbord dicht en de knop terug: meestal was het één uitspraak
    input?.blur();
  }
</script>

<!-- Trektelling starten naast de GPS: die regel staat er al, dus de knop kost
     de lijst geen ruimte. Niet in de duimzone: je start hem één keer per
     sessie, op een vaste plek, en zo raak je hem niet per ongeluk tijdens het
     lopen (een trektelling houdt de microfoon tot 4 uur aan). -->
<div class="top">
  <p class="gps {gps.status}">
    <span class="dot"></span>
    {#if gps.status === 'ok' && gps.latest}
      Locatie ±{Math.round(gps.latest.accuracy)} m
    {:else}
      {gpsLabels[gps.status]}
    {/if}
  </p>
  {#if trektelOn && trektel.startedAt === undefined}
    <button
      class="trektel-start"
      disabled={recorder.status !== 'idle' || trektel.status !== 'idle'}
      onclick={beginTrektel}
    >
      {trektel.status === 'starting' ? 'Microfoon aanzetten…' : 'Trektelling starten'}
    </button>
  {/if}
</div>

<form onsubmit={submit} onfocusin={() => (typing = true)} onfocusout={() => (typing = false)}>
  <input
    bind:this={input}
    bind:value={text}
    placeholder="Of typ: zes overvliegende houtduiven"
    aria-label="Uitspraak typen"
    autocomplete="off"
    enterkeyhint="send"
  />
  <button aria-label="Verwerk">
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M5 12h13M13 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</form>

<SessionLog {session} />

<!-- Onderaan, in de duimzone: bereikbaar met één hand, ook als je door de
     lijst scrolt. Weg tijdens het typen, anders staat hij op het toetsenbord. -->
<div class="talk-space" style:height="{barHeight}px"></div>
<div
  class="talk-bar"
  class:hidden={typing && recorder.status !== 'recording'}
  bind:clientHeight={barHeight}
>
  <!-- Ook tijdens een pauze en het weer aanzetten van de microfoon (startedAt staat dan) -->
  {#if trektel.startedAt !== undefined}
    <button class="talk recording" onclick={endTrektel}>
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
      </svg>
      <span>Stop trektelling · {clock(trektelElapsed)}</span>
    </button>
    <!-- Altijd één regel even breed: liep hij over naar twee regels zodra de
         app spraak hoorde, dan sprong de stopknop steeds op en neer (Maarten) -->
    <p class="mic listening">
      <span class="ear" class:speaking={trektel.speaking}></span>
      <span class="hearing"
        >{trektel.status !== 'running'
          ? 'Microfoon aanzetten'
          : trektel.speaking
            ? 'Hoort spraak'
            : 'Luistert'}</span
      >
      <!-- Pas na het eerste stuk: "eerste stuk na 1 minuut" was onduidelijk (feedback 12 nov) -->
      {#if trektel.sent > 0}
        ·
        <span class="sent">{trektel.sent} {trektel.sent === 1 ? 'stuk' : 'stukken'} verstuurd</span>
      {/if}
    </p>
  {:else}
    {#if trektelOn && trektel.error}
      <p class="mic denied">{trektel.error}</p>
    {/if}
    <button
      class="talk"
      class:recording={recorder.status === 'recording'}
      disabled={recorder.status === 'unsupported'}
      onpointerdown={press}
      onpointerup={release}
      onpointercancel={cancel}
      oncontextmenu={(event) => event.preventDefault()}
    >
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
        {#if recorder.status === 'recording'}
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        {:else}
          <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" />
          <path
            d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        {/if}
      </svg>
      <span>
        {recorder.status === 'recording'
          ? `Stop · ${Math.floor(elapsed / 1000)} s`
          : recorder.status === 'starting'
            ? 'Microfoon aanzetten…'
            : 'Inspreken'}
      </span>
    </button>
    {#if micMessage}
      <p class="mic denied">{micMessage}</p>
    {/if}
  {/if}
</div>

<style>
  .gps {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0.75rem 0 0;
    padding: 0.2rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 2rem;
    font-size: 0.85rem;
    color: var(--muted);
    background: var(--surface);
  }

  .gps.off {
    display: none;
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--muted);
  }

  .gps.ok .dot {
    background: var(--rarity-1);
  }

  .gps.searching .dot {
    background: var(--rarity-3);
  }

  .gps.denied,
  .gps.unavailable,
  .mic.denied {
    color: var(--red);
  }

  .gps.denied .dot,
  .gps.unavailable .dot {
    background: var(--red);
  }

  .talk-bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 10;
    display: grid;
    justify-items: center;
    /* Onderaan ruimte voor de gloed van de opnamepuls (14 px, feedback 12 nov) */
    padding: 1.25rem 1rem calc(1rem + env(safe-area-inset-bottom));
    /* De lijst schuift er zichtbaar onderdoor */
    background: linear-gradient(transparent, var(--bg) 1.25rem);
    pointer-events: none;
  }

  .talk-bar > * {
    width: 100%;
    max-width: 30rem;
    pointer-events: auto;
  }

  .talk-bar.hidden {
    display: none;
  }

  .talk {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    min-height: 8rem;
    border: none;
    border-radius: 1.25rem;
    font: inherit;
    font-size: 1.4rem;
    font-weight: 650;
    color: var(--on-brand);
    background: var(--brand);
    box-shadow:
      0 2px 0 var(--brand-strong),
      0 6px 16px rgb(60 55 50 / 0.18);
    transition:
      transform 80ms,
      background 150ms;
    /* Geen tekstselectie of contextmenu bij lang indrukken op Android */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
  }

  .talk:active {
    transform: translateY(1px) scale(0.995);
  }

  .talk.recording {
    background: var(--breast);
    box-shadow: 0 2px 0 var(--breast-strong);
    animation: pulse 1.4s ease-out infinite;
  }

  .talk span {
    font-variant-numeric: tabular-nums;
  }

  @keyframes pulse {
    0% {
      box-shadow:
        0 2px 0 var(--breast-strong),
        0 0 0 0 color-mix(in srgb, var(--breast) 45%, transparent);
    }
    100% {
      box-shadow:
        0 2px 0 var(--breast-strong),
        0 0 0 14px transparent;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .talk.recording {
      animation: none;
    }
  }

  .talk:disabled {
    opacity: 0.5;
  }

  .mic {
    margin: 0.35rem 0 0;
    min-height: 1.5em;
    text-align: center;
    /* Ook foutmeldingen (geen microfoon): in het veld leesbaar, minstens 16 px */
    font-size: 1rem;
    color: var(--muted);
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.75rem;
  }

  .top .gps {
    margin: 0;
  }

  .trektel-start {
    position: relative;
    margin-left: auto;
    padding: 0.3rem 0.85rem;
    border: 1px solid var(--brand);
    border-radius: 2rem;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--brand);
    background: var(--surface);
  }

  /* Tikvlak minstens 48 px hoog, zonder dat de regel hoger wordt */
  .trektel-start::after {
    content: '';
    position: absolute;
    inset: -0.6rem -0.25rem;
  }

  .trektel-start:disabled {
    opacity: 0.5;
  }

  .mic.listening {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--fg);
    white-space: nowrap;
  }

  /* Vaste breedte, zodat de regel niet verschuift tussen Luistert en Hoort spraak */
  .hearing {
    min-width: 6.5em;
    text-align: right;
  }

  .sent {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Lampje: brandt als de app spraak hoort, zodat je ziet dat hij luistert */
  .ear {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: var(--border);
    transition: background 100ms;
  }

  .ear.speaking {
    background: var(--breast);
  }

  form {
    display: flex;
    margin: 0.75rem 0 1.25rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  form:focus-within {
    border-color: var(--brand);
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0.75rem 0.9rem;
    border: none;
    outline: none;
    font: inherit;
    background: transparent;
    color: var(--fg);
  }

  form button {
    display: grid;
    place-items: center;
    width: 3rem;
    border: none;
    color: var(--on-brand);
    background: var(--brand);
  }
</style>
