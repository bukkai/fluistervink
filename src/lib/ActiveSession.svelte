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
  {recorder.status === 'recording' ? `Stop · ${Math.floor(elapsed / 1000)} s` : 'Inspreken'}
</button>
<p class="mic {recorder.status}">
  {micLabels[recorder.status]}
</p>

<form onsubmit={submit}>
  <input
    bind:value={text}
    placeholder="Of typ: zes overvliegende houtduiven"
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
  .gps.unavailable,
  .mic.denied,
  .mic.unsupported {
    color: var(--red);
  }

  .talk {
    display: block;
    width: 100%;
    margin-top: 1rem;
    padding: 2.5rem 1rem;
    border-radius: 1rem;
    font-size: 1.5rem;
    font-weight: 600;
    /* Geen tekstselectie of contextmenu bij lang indrukken op Android */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: none;
  }

  .talk.recording {
    background: var(--red);
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
