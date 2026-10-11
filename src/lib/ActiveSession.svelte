<script lang="ts">
  import { nameFromStart } from './area';
  import type { PositionLookup, Session } from './db';
  import { vibrate } from './feedback';
  import { logEvent } from './log';
  import { currentPosition, gps, startTracking, stopTracking } from './location.svelte';
  import { submitRecording, submitText } from './observations';
  import { recorder, startRecording, stopRecording } from './recorder.svelte';
  import SessionLog from './SessionLog.svelte';

  let { session }: { session: Session } = $props();

  let text = $state('');

  // GPS aan zolang dit scherm (de lopende wandeling) zichtbaar is
  $effect(() => {
    startTracking();
    return () => {
      stopTracking();
      // Wandeling gestopt tijdens een opname: microfoon uit, opname bewaren
      if (recorder.status === 'recording') finishRecording();
    };
  });

  // Voorlopige naam van de wandeling uit de startpositie. Niet bij voortzetten.
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

  /** Langer ingedrukt dan dit = vasthouden (loslaten stopt); korter = tikken (nog eens tikken stopt). */
  const HOLD_MS = 400;
  /** Vergeten te stoppen: na een minuut stopt de opname vanzelf. */
  const MAX_RECORDING_MS = 60_000;

  let pressedAt = 0;
  let lookup: Promise<PositionLookup> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let elapsed = $state(0);

  async function press(event: PointerEvent) {
    event.preventDefault();
    // Loslaten telt ook als de vinger van de knop afglijdt
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    if (recorder.status === 'starting') return;
    if (recorder.status === 'recording') {
      finishRecording();
      return;
    }
    pressedAt = Date.now();
    // Tijd en positie horen bij het begin van de opname, niet bij het eind
    lookup = currentPosition();
    if (await startRecording()) {
      vibrate('recording');
      maxTimer = setTimeout(finishRecording, MAX_RECORDING_MS);
    }
  }

  function release() {
    if (recorder.status === 'recording' && Date.now() - pressedAt > HOLD_MS) finishRecording();
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

  const micLabels: Record<typeof recorder.status, string> = {
    idle: 'Tik of houd vast om in te spreken',
    starting: 'Microfoon aanzetten…',
    recording: 'Loslaten of tikken om te stoppen',
    denied: 'Geen toegang tot de microfoon. Sta dit toe in de browserinstellingen.',
    unsupported: 'Opnemen kan niet in deze browser.',
  };

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
  <span class="dot"></span>
  {#if gps.status === 'ok' && gps.latest}
    Locatie ±{Math.round(gps.latest.accuracy)} m
  {:else}
    {gpsLabels[gps.status]}
  {/if}
</p>

<button
  class="talk"
  class:recording={recorder.status === 'recording'}
  disabled={recorder.status === 'unsupported'}
  onpointerdown={press}
  onpointerup={release}
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
    {recorder.status === 'recording' ? `Stop · ${Math.floor(elapsed / 1000)} s` : 'Inspreken'}
  </span>
</button>
<p class="mic {recorder.status}">
  {micLabels[recorder.status]}
</p>

<form onsubmit={submit}>
  <input
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
  .mic.denied,
  .mic.unsupported {
    color: var(--red);
  }

  .gps.denied .dot,
  .gps.unavailable .dot {
    background: var(--red);
  }

  .talk {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    min-height: 10rem;
    margin-top: 0.75rem;
    border: none;
    border-radius: 1.25rem;
    font: inherit;
    font-size: 1.4rem;
    font-weight: 650;
    color: var(--on-brand);
    background: var(--brand);
    box-shadow: 0 2px 0 var(--brand-strong), 0 6px 16px rgb(40 60 80 / 0.2);
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
    background: var(--red);
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
    margin: 0.5rem 0 0;
    min-height: 1.5em;
    text-align: center;
    font-size: 0.9rem;
    color: var(--muted);
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
