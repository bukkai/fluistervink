<script lang="ts">
  import { t } from './i18n';
  import { untrack } from 'svelte';
  import { nameFromStart } from './area';
  import type { PositionLookup, Session } from './db';
  import { vibrate } from './feedback';
  import { logEvent } from './log';
  import { preferenceOn } from './preferences';
  import { listenVolumeKey, setWebRecording, volumeKeySupported } from './native';
  import { recordFix } from './effort';
  import { watchKeyboard } from './keyboard';
  import { currentPosition, gps, startTracking, stopTracking } from './location.svelte';
  import { onDailyLimit, onLongWait, onSaveFailed, submitRecording, submitText } from './queue';
  import {
    onRecordingInterrupted,
    recorder,
    startRecording,
    stopRecording,
  } from './recorder.svelte';
  import { screenOff, screenOffEnabled, startScreenOff, stopScreenOff } from './screenOff.svelte';
  import { holdScreenOn } from './screenWakeLock';
  import SessionLog from './SessionLog.svelte';
  import { positionLater } from './utterancePosition';
  import {
    chunkPosition,
    endTrektelPosition,
    noteTrektelFix,
    resetTrektelPosition,
    startTrektelPosition,
  } from './trektelPosition';
  import { syncSessionService } from './sessionService';
  import { createTalkButton } from './talkButton';
  import { trektelEnabled } from './trektel';
  import { startTuintelCount, tuintelPhase } from './tuintelling';
  import { startTrektel, stopTrektel, trektel, trektelSupported } from './trektelRecorder.svelte';
  import { microphoneLine, refreshMicrophones } from './microphoneStatus.svelte';

  let { session }: { session: Session } = $props();

  let text = $state('');
  /**
   * Typen, in het veld bovenaan of in een geopende waarneming: dan staat het
   * toetsenbord waar de knop zit
   */
  let typing = $state(false);
  /**
   * De waarneming die open staat om aan te passen: dan een kleine knop rechts,
   * zodat hij het formulier en de knop Opslaan niet bedekt (feedback 16 nov)
   */
  let editing = $state<string>();
  /** Ruimte onder de lijst, zodat de knop de laatste waarneming niet bedekt */
  let barHeight = $state(0);
  let input = $state<HTMLInputElement>();

  // Voor de knop Opslaan van een geopende waarneming (ObservationEditor, .buttons):
  // rechts ruimte voor het kleine rondje, of tijdens een trektelling (grote knop
  // blijft staan) erboven plakken in plaats van eronder.
  $effect(() => {
    const root = document.documentElement.style;
    const open = editing !== undefined;
    const compact = open && trektel.startedAt === undefined;
    root.setProperty('--talk-bar-room', compact ? '4.5rem' : '0px');
    root.setProperty('--talk-bar-offset', open && !compact ? `${barHeight}px` : '0px');
    return () => {
      root.removeProperty('--talk-bar-room');
      root.removeProperty('--talk-bar-offset');
    };
  });

  // Toetsenbord dicht zonder dat het veld loslaat: dan zelf loslaten (keyboard.ts)
  $effect(() =>
    watchKeyboard(
      (on) => (typing = on),
      (sizes) => logEvent('keyboard_closed', sizes, { sessionId: session.id }),
    ),
  );

  // GPS aan zolang dit scherm (de lopende sessie) zichtbaar is
  $effect(() => {
    startTracking();
    return () => {
      stopTracking();
      // Sessie gestopt tijdens een opname: microfoon uit, opname bewaren
      closed = true;
      if (recorder.status === 'recording') finishRecording();
      stopTrektel();
      resetTrektelPosition();
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

  // Trektelling: elke meting kan de plek van de stukken verbeteren
  // (trektelPosition.ts); bij het stoppen van de telling niet meer
  $effect(() => {
    const fix = gps.latest;
    if (fix) noteTrektelFix($state.snapshot(fix));
  });
  $effect(() => {
    if (trektel.status === 'idle') endTrektelPosition();
  });

  // Eerste meting (of weer een na zoeken): uitspraken van daarvoor zonder
  // plek krijgen hem alsnog (vliegtuigmodus, binnen: de eerste fix kan
  // minuten duren)
  let hadFix = false;
  $effect(() => {
    const fix = gps.status === 'ok' ? gps.latest : undefined;
    if (fix && !hadFix)
      positionLater(
        $state.snapshot(fix),
        untrack(() => session.id),
      );
    hadFix = fix !== undefined;
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
  // Behalve met de proef opnemen met het scherm uit: dan mag de app op de
  // achtergrond de microfoon houden (service met type microfoon), en stopt de
  // volumeknop de opname.
  $effect(() => {
    function onHidden() {
      if (!document.hidden || recorder.status !== 'recording') return;
      if (screenOff.ready) {
        logEvent('recording_continues_hidden', undefined, { sessionId: session.id });
        return;
      }
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

  // Stop tijdens een opname: dit scherm is dan al weg als de opname klaar is,
  // en `session` wijst niet meer naar deze sessie (de lopende is er niet
  // meer). Daarom het id van het begin; anders ging die opname verloren.
  const thisSession = untrack(() => session.id);
  /** Dit scherm is weg (sessie gestopt) */
  let closed = false;

  let lookup: Promise<PositionLookup> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let elapsed = $state(0);
  // Een opname van de service (scherm uit, ontwikkeloptie) telt als lopende
  // opname: de knop zegt Stop en stopt hem, als het scherm weer aan is
  let talkStatus = $derived(screenOff.startedAt !== undefined ? 'recording' : recorder.status);
  let talkStartedAt = $derived(screenOff.startedAt ?? recorder.startedAt);
  let talkLabel = $derived(
    talkStatus === 'recording'
      ? t('session.talkStop', { s: Math.floor(elapsed / 1000) })
      : recorder.status === 'starting'
        ? t('session.micStarting')
        : t('session.talk'),
  );

  // Tikken of vasthouden, bestand tegen haperend contact (handschoenen)
  const talk = createTalkButton({
    status: () => talkStatus,
    start: async () => {
      // Tijd en positie horen bij het begin van de opname, niet bij het eind
      lookup = currentPosition();
      // Lukte de service bij de start nog niet (geen locatietoestemming), dan nu
      syncSessionService(session.id);
      if (!(await startRecording({ measureHidden: screenOff.ready }))) {
        // Niet stil mislukken: wie niet naar het scherm kijkt, denkt anders dat hij opneemt
        if (recorder.failed) vibrate('failed');
        return false;
      }
      // Gestopt terwijl de microfoon nog opstartte: niet doorlopen na de sessie
      if (closed) {
        void finishRecording();
        return false;
      }
      vibrate('recording');
      maxTimer = setTimeout(finishRecording, MAX_RECORDING_MS);
      if (session.tuintelling) void startTuintelCount(session.id);
      return true;
    },
    finish: () => (screenOff.startedAt !== undefined ? stopScreenOff() : finishRecording()),
    log: (type, data) => logEvent(type, data, { sessionId: session.id }),
  });

  // Volumeknop als inspreekknop (Android-app, instelling): elke druk is een
  // tik op de knop. Niet tijdens een trektelling: die heeft een eigen knop.
  // Bij een tuintelling begint hij het tellen, pauzeert hij het en gaat hij
  // verder, net als de knop op het scherm (tuintelling 22 nov).
  const volumeKeyOn = volumeKeySupported && preferenceOn('volumeknop');
  $effect(() => {
    if (!volumeKeyOn || (trektel.status !== 'idle' && !tuinTrektel)) return;
    return listenVolumeKey((key) => {
      logEvent(
        'talk_volume_key',
        { key, status: recorder.status, tuintel: tuinTrektel ? trektel.status : undefined },
        { sessionId: session.id },
      );
      if (!tuinTrektel) talk.tap();
      else if (trektel.status === 'idle') void beginTuintel();
      else if (trektel.status === 'running' || trektel.status === 'paused') endTrektel();
    });
  });

  // Scherm aan houden zolang de sessie open staat (instelling, screenWakeLock.ts)
  $effect(() => {
    if (!preferenceOn('schermAan')) return;
    const sessionId = untrack(() => session.id);
    return holdScreenOn((type, data) => logEvent(type, data, { sessionId }));
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
    // Niet als de opname stopte omdat de app naar de achtergrond ging; wel
    // als hij met het scherm uit doorliep en de volumeknop hem stopte
    if (!document.hidden) vibrate('recorded');
    else if (screenOff.ready) vibrate('screenOffStop');
    if (recording.chunkStats) {
      logEvent(
        'recording_chunks',
        { durationMs: recording.durationMs, ...recording.chunkStats },
        { sessionId: thisSession },
      );
    }
    // Een vorige melding "niet bewaard" geldt niet meer; mislukt het weer, dan komt hij terug
    saveError = undefined;
    await submitRecording(thisSession, recording, lookup);
  }

  // Opname vanzelf gestopt (gebeld, oortjes weg): bewaren wat er was
  $effect(() =>
    onRecordingInterrupted(() => {
      logEvent('recording_interrupted', undefined, { sessionId: session.id });
      void finishRecording();
    }),
  );

  // Opnemen met het scherm uit (ontwikkeloptie, screenOff.svelte.ts): de
  // volumeknop met het scherm uit neemt op in de service. Niet tijdens een
  // trektelling van de webcode: die heeft de microfoon al. Wel tijdens een
  // trektelling in de service: die heeft juist het type microfoon nodig
  // (loslaten en opnieuw aanzetten kan niet vanaf de achtergrond).
  const webTrektel = $derived(trektel.status !== 'idle' && !trektel.native);
  $effect(() => {
    if (webTrektel) return;
    return startScreenOff(
      untrack(() => session.id),
      MAX_RECORDING_MS,
      // Scherm op slot tijdens een opname met de knop: de volumeknop stopt hem
      () => {
        if (recorder.status === 'recording') finishRecording();
      },
    );
  });

  // De service moet weten of de app zelf opneemt: dan stopt de volumeknop met
  // het scherm uit die opname, in plaats van er een tweede te starten
  $effect(() => {
    const busy = recorder.status === 'recording';
    if (screenOffEnabled()) setWebRecording(busy);
  });

  // Lopende tijd tijdens de opname
  $effect(() => {
    if (talkStatus !== 'recording') return;
    const timer = setInterval(() => (elapsed = Date.now() - (talkStartedAt ?? 0)), 200);
    return () => {
      clearInterval(timer);
      elapsed = 0;
    };
  });

  // Welke microfoon luistert: alleen een regel als er oortjes met microfoon
  // zijn (feedback 17 nov). Opnieuw kijken als er iets verbonden wordt.
  $effect(() => {
    void refreshMicrophones();
    const media = navigator.mediaDevices;
    const onChange = () => void refreshMicrophones();
    media?.addEventListener('devicechange', onChange);
    // De Android-app hoort Bluetooth niet altijd via devicechange
    const timer = setInterval(onChange, 30_000);
    return () => {
      media?.removeEventListener('devicechange', onChange);
      clearInterval(timer);
    };
  });
  let micLine = $derived(microphoneLine());

  // Trektelmodus (docs/plan-trektelmodus.md): alleen als hij bij Instellingen
  // aanstaat. Niet bij een tuintelling: die heeft zijn eigen knop onderaan.
  let trektelOn = $derived(trektelEnabled() && trektelSupported() && !session.tuintelling);

  // Tuintelling (tuintelling.ts): tellen gaat in de trektelstand, met één
  // knop "Begin met tellen" in de duimzone; daar begint het half uur. Zonder
  // trektelstand (oude browser) de gewone knop, en dan begint het half uur
  // bij de eerste opname. Na afloop (nog iets vergeten) ook de gewone knop.
  let now = $state(Date.now());
  $effect(() => {
    if (!session.tuintelling) return;
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });
  let tuinPhase = $derived(tuintelPhase(session, now));
  let tuinTrektel = $derived(
    trektelSupported() && (tuinPhase === 'before' || tuinPhase === 'counting'),
  );

  async function beginTuintel() {
    await beginTrektel();
    if (trektel.status !== 'idle') await startTuintelCount(session.id);
  }

  async function beginTrektel() {
    if (recorder.status !== 'idle') return;
    syncSessionService(session.id);
    const sessionId = session.id;
    startTrektelPosition(sessionId, Date.now(), gps.latest && $state.snapshot(gps.latest));
    const started = await startTrektel(
      {
        // Je staat stil: de beste meting van deze telling (trektelPosition.ts)
        onChunkStart: () => chunkPosition(sessionId),
        onChunk: (recording, chunkLookup) =>
          submitRecording(sessionId, recording, chunkLookup, { trektel: true }),
        onStopped: () => vibrate('trektelStopped'),
        onPaused: () => vibrate('trektelPaused'),
        onResumed: () => vibrate('recording'),
      },
      // Proef scherm uit: de service neemt de telling op, het scherm mag uit.
      // Altijd proberen met de optie aan: de service zegt zelf of het kan
      // (anders de gewone trektelling, `trektel_native_failed` in het log)
      { native: screenOffEnabled() },
    );
    if (started) vibrate('recording');
  }

  // Plafond per dag bereikt (5 uur spraak of 500 keer het model, proxy): de trektelling stoppen in
  // plaats van stukken op te nemen die vandaag niet meer verwerkt worden
  $effect(() =>
    onDailyLimit((limit) => {
      if (trektel.status === 'idle') return;
      stopTrektel('limit');
      const why = limit === 'audio' ? t('session.limitAudio') : t('session.limitModel');
      trektel.error = t('session.trektelStoppedLimit', { why });
    }),
  );

  // Uitspraak niet bewaard, meestal omdat de telefoon vol is: zeggen, en een
  // trektelling stoppen (elk volgend stuk zou ook verloren gaan)
  let saveError = $state<string>();
  $effect(() =>
    onSaveFailed((full) => {
      const why = full ? t('session.saveFailedFull') : t('session.saveFailed');
      if (trektel.status === 'idle') {
        saveError = why;
        return;
      }
      stopTrektel('storage');
      trektel.error = t('session.trektelStoppedSave', { why });
    }),
  );

  // Trektelling zonder bereik: al 2 uur wachten de stukken (offline wachtrij,
  // docs/archief/plan-offline.md). Twee lange trillen; de regel boven de lijst zegt het
  // ook. De telling gaat gewoon door.
  $effect(() =>
    onLongWait(() => {
      if (trektel.status !== 'idle') vibrate('trektelStopped');
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
      ? t('session.micDenied')
      : recorder.status === 'unsupported'
        ? t('session.micUnsupported')
        : recorder.failed && recorder.status === 'idle'
          ? t('session.micFailed')
          : undefined,
  );

  const gpsLabels: Record<typeof gps.status, string> = {
    off: '',
    ok: '',
    searching: t('session.gpsSearching'),
    denied: t('session.gpsDenied'),
    unavailable: t('session.gpsUnavailable'),
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
      {t('session.gpsAccuracy', { m: Math.round(gps.latest.accuracy) })}
    {:else if gps.status === 'searching' && gps.slow}
      {t('session.gpsSlow')}
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
      {trektel.status === 'starting' ? t('session.micStarting') : t('session.trektelStart')}
    </button>
  {/if}
</div>

<form onsubmit={submit}>
  <input
    bind:this={input}
    bind:value={text}
    placeholder={t('session.typePlaceholder')}
    aria-label={t('session.typeLabel')}
    autocomplete="off"
    enterkeyhint="send"
  />
  <button aria-label={t('session.submit')}>
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

<SessionLog {session} bind:editing />

<!-- Onderaan, in de duimzone: bereikbaar met één hand, ook als je door de
     lijst scrolt. Weg tijdens het typen, anders staat hij op het toetsenbord. -->
<div class="talk-space" style:height="{barHeight}px"></div>
<div
  class="talk-bar"
  class:hidden={typing && talkStatus !== 'recording'}
  class:compact={editing !== undefined && trektel.startedAt === undefined}
  bind:clientHeight={barHeight}
>
  <!-- Ook tijdens een pauze en het weer aanzetten van de microfoon (startedAt staat dan) -->
  {#if trektel.startedAt !== undefined}
    <button class="talk recording" onclick={endTrektel}>
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
      </svg>
      <span>{t('session.trektelStop', { clock: clock(trektelElapsed) })}</span>
    </button>
    <!-- Altijd één regel even breed: liep hij over naar twee regels zodra de
         app spraak hoorde, dan sprong de stopknop steeds op en neer (Maarten) -->
    <p class="mic listening">
      <span class="ear" class:speaking={trektel.speaking}></span>
      <span class="hearing">
        {trektel.status === 'paused'
          ? t('session.trektelPaused')
          : trektel.status !== 'running'
            ? t('session.trektelMicStarting')
            : trektel.speaking
              ? t('session.trektelHearing')
              : t('session.trektelListening')}
      </span>
      <!-- Pas na het eerste stuk: "eerste stuk na 1 minuut" was onduidelijk (feedback 12 nov) -->
      {#if trektel.sent > 0}
        ·
        <span class="sent">{t('session.trektelSent', { n: trektel.sent })}</span>
      {/if}
    </p>
    {#if micLine}
      <p class="mic source">{micLine}</p>
    {/if}
  {:else if tuinTrektel}
    <!-- Tuintelling: de microfoon blijft aan, zoals bij de trektelling -->
    {#if trektel.error}
      <p class="mic denied">{trektel.error}</p>
    {/if}
    <button
      class="talk"
      disabled={recorder.status !== 'idle' || trektel.status !== 'idle'}
      onclick={beginTuintel}
    >
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
        <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" />
        <path
          d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <span>
        {trektel.status === 'starting'
          ? t('session.micStarting')
          : tuinPhase === 'before'
            ? t('session.tuintelStart')
            : t('session.tuintelResume')}
      </span>
    </button>
    <p class="mic source">
      {tuinPhase === 'before' ? t('session.tuintelStartHint') : t('session.tuintelResumeHint')}
    </p>
  {:else}
    {#if trektelOn && trektel.error}
      <p class="mic denied">{trektel.error}</p>
    {/if}
    <button
      class="talk"
      class:recording={talkStatus === 'recording'}
      disabled={recorder.status === 'unsupported'}
      onpointerdown={press}
      onpointerup={release}
      onpointercancel={cancel}
      oncontextmenu={(event) => event.preventDefault()}
      aria-label={editing === undefined ? undefined : talkLabel}
    >
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
        {#if talkStatus === 'recording'}
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
      <span>{talkLabel}</span>
    </button>
    {#if saveError}
      <p class="mic denied">{saveError}</p>
    {:else if micMessage}
      <p class="mic denied">{micMessage}</p>
    {:else if micLine}
      <p class="mic source">{micLine}</p>
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

  /* Een waarneming staat open: een ronde knop rechts naast Opslaan, alleen
     het pictogram (ObservationEditor houdt daar ruimte voor vrij) */
  .talk-bar.compact {
    justify-items: end;
    padding: 0 1rem calc(0.25rem + env(safe-area-inset-bottom));
    background: none;
  }

  .talk-bar.compact > * {
    width: auto;
  }

  .talk-bar.compact .talk {
    width: 4rem;
    min-height: 4rem;
    border-radius: 50%;
  }

  .talk-bar.compact .talk span {
    display: none;
  }

  /* De uitlegregel onder de knop ("Het half uur loopt door", de microfoon)
     zou over Annuleren vallen; een foutmelding blijft wel staan */
  .talk-bar.compact .mic.source {
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
    color: var(--brand-strong);
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
