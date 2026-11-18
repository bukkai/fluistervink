<script lang="ts">
  // "Probeer het eens" in het welkom: één zin inspreken en zien wat
  // Fluistervink ervan maakt, met de tril die erbij hoort. Er wordt niets
  // bewaard (tryout.ts). De knop werkt zoals die in een sessie: tikken (nog
  // eens tikken stopt) of vasthouden (loslaten stopt).
  import { onDestroy } from 'svelte';
  import { vibrate } from './feedback';
  import { logEvent } from './log';
  import { preferenceOn } from './preferences';
  import {
    onRecordingInterrupted,
    recorder,
    startRecording,
    stopRecording,
  } from './recorder.svelte';
  import { createTalkButton } from './talkButton';
  import { tryErrorText, tryUtterance, type TryResult } from './tryout';
  import { permissionSettingsPath } from './welcome';

  /** Ruim genoeg voor een zin; daarna stopt de opname vanzelf */
  const MAX_RECORDING_MS = 30_000;

  let busy = $state(false);
  let result = $state<TryResult>();
  let error = $state<string>();
  let elapsed = $state(0);
  let maxTimer: ReturnType<typeof setTimeout> | undefined;

  const talk = createTalkButton({
    status: () => recorder.status,
    start: async () => {
      if (busy) return false;
      if (!(await startRecording())) {
        if (recorder.failed) vibrate('failed');
        return false;
      }
      vibrate('recording');
      result = undefined;
      error = undefined;
      maxTimer = setTimeout(finish, MAX_RECORDING_MS);
      return true;
    },
    finish,
    log: (type, data) => logEvent(type, { ...data, tryout: true }),
  });

  async function finish() {
    clearTimeout(maxTimer);
    const recording = await stopRecording();
    if (!recording) return;
    vibrate('recorded');
    busy = true;
    try {
      result = await tryUtterance(recording.audio, preferenceOn('soortgroepen'));
      // Dezelfde tril als in een sessie, zodat je hem leert kennen
      vibrate(
        !result.lines.length
          ? 'ignored'
          : result.lines.some((line) => line.uncertain)
            ? 'uncertain'
            : 'saved',
      );
    } catch (e) {
      error = tryErrorText(e);
      // Zonder dit was niet na te gaan waarom het mislukte (feedback 18 nov)
      logEvent('tryout_failed', {
        message: e instanceof Error ? e.message : String(e),
        code: (e as { code?: unknown })?.code,
        online: navigator.onLine,
      });
      vibrate('failed');
    } finally {
      busy = false;
    }
  }

  // Opname vanzelf gestopt (gebeld, oortjes weg): toch laten zien wat er was
  $effect(() => onRecordingInterrupted(() => void finish()));

  // Weg uit deze stap tijdens een opname: microfoon uit, niets verwerken
  onDestroy(() => {
    clearTimeout(maxTimer);
    if (recorder.status === 'recording') void stopRecording();
  });

  $effect(() => {
    if (recorder.status !== 'recording') return;
    const timer = setInterval(() => (elapsed = Date.now() - (recorder.startedAt ?? 0)), 200);
    return () => {
      clearInterval(timer);
      elapsed = 0;
    };
  });

  let label = $derived(
    busy
      ? 'Even luisteren…'
      : recorder.status === 'recording'
        ? `Klaar? Tik nog eens · ${Math.floor(elapsed / 1000)} s`
        : recorder.status === 'starting'
          ? 'Microfoon aanzetten…'
          : result || error
            ? 'Nog een keer'
            : 'Tik en zeg het',
  );

  let trill = $derived(
    !result?.lines.length
      ? 'Twee korte trillen: niets herkend. Zeg het nog eens.'
      : result.lines.some((line) => line.uncertain)
        ? 'Een korte en een lange tril: in een sessie betekent dat opgeslagen, maar onzeker. Die loop je thuis na.'
        : 'Eén korte tril: in een sessie betekent dat opgeslagen.',
  );

  function press(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    talk.down();
  }
</script>

<div class="tryout">
  <button
    class="talk"
    class:recording={recorder.status === 'recording'}
    disabled={busy || recorder.status === 'unsupported'}
    onpointerdown={press}
    onpointerup={(event) => event.isPrimary && talk.up()}
    onpointercancel={(event) => event.isPrimary && talk.cancel()}
    oncontextmenu={(event) => event.preventDefault()}
  >
    <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
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
    <span>{label}</span>
  </button>

  <div role="status">
    {#if recorder.status === 'denied'}
      <p class="error">
        De app mag de microfoon niet gebruiken. Aanzetten kan bij {permissionSettingsPath}.
      </p>
    {:else if recorder.status === 'unsupported'}
      <p class="error">Deze browser kan niet opnemen.</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if result}
      <div class="result card">
        {#if result.transcript}
          <p class="heard">Fluistervink verstond: <q>{result.transcript}</q></p>
        {:else}
          <p class="heard">Fluistervink verstond niets.</p>
        {/if}
        {#if result.lines.length}
          <ul>
            {#each result.lines as line, i (i)}
              <li>
                {line.text}{#if line.uncertain}<span class="uncertain"> · onzeker</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
        <p class="trill">{trill}</p>
        <p class="note">Dit was een proef: er is niets bewaard.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .tryout {
    display: grid;
    gap: 1rem;
    width: 100%;
    max-width: 24rem;
  }

  p,
  ul {
    margin: 0;
  }

  .talk {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    min-height: 6.5rem;
    border: none;
    border-radius: 1.25rem;
    font: inherit;
    font-size: 1.2rem;
    font-weight: 650;
    color: var(--on-brand);
    background: var(--brand);
    box-shadow:
      0 2px 0 var(--brand-strong),
      0 6px 16px rgb(60 55 50 / 0.18);
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
  }

  .talk.recording {
    background: var(--breast);
    box-shadow: 0 2px 0 var(--breast-strong);
  }

  .talk:disabled {
    opacity: 0.6;
  }

  .talk span {
    font-variant-numeric: tabular-nums;
  }

  .result {
    display: grid;
    gap: 0.6rem;
    padding: 1rem;
    text-align: left;
  }

  .heard {
    color: var(--muted);
  }

  ul {
    padding-left: 1.25rem;
    font-weight: 600;
  }

  .uncertain {
    font-weight: 400;
    color: var(--muted);
  }

  .trill {
    font-size: 0.95rem;
  }

  .note {
    font-size: 0.9rem;
    color: var(--muted);
  }
</style>
