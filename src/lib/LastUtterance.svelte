<script lang="ts">
  // "Wat zei ik?" (ontwikkeloptie, devOptions.ts): op het sessiescherm de
  // laatste uitspraak met wat de spraakherkenning verstond, en een knop om
  // de opname te horen. Zo zie je in het veld waarom iets misging ("hier"
  // in plaats van "vier") en kun je meteen verbeteren. Eén regel boven de
  // inspreekknop; tik op de tekst voor het hele transcript.
  import { liveQuery } from 'dexie';
  import { audioBlob, db, type Utterance } from './db';
  import { playback } from './playback.svelte';

  let { sessionId }: { sessionId: string } = $props();

  const last = $derived(
    liveQuery(async () => {
      const all = await db.utterances.where('sessionId').equals(sessionId).sortBy('recordedAt');
      // Feedback afgesplitst uit een trektelstuk heeft geen eigen opname
      return all.reverse().find((u) => !u.fromUtteranceId);
    }),
  );

  let audio: HTMLAudioElement | undefined;
  let url: string | undefined;
  let playingId = $state<string>();
  let open = $state(false);
  const PLAY = '▶︎';
  const PAUSE = '⏸︎';

  function stop() {
    audio?.pause();
    if (url) URL.revokeObjectURL(url);
    audio = url = undefined;
    playingId = undefined;
    playback.playing = false;
  }

  function toggle(u: Utterance) {
    if (playingId === u.id && audio) {
      if (audio.paused) audio.play();
      else audio.pause();
      return;
    }
    stop();
    url = URL.createObjectURL(audioBlob(u.audio!));
    audio = new Audio(url);
    audio.onplay = () => {
      playingId = u.id;
      playback.playing = true;
    };
    audio.onpause = () => (playback.playing = false);
    audio.onended = stop;
    audio.play();
  }

  $effect(() => stop);

  // Een nieuwe uitspraak begint weer ingeklapt
  let shownId: string | undefined;
  $effect(() => {
    const id = $last?.id;
    if (id !== shownId) {
      shownId = id;
      open = false;
    }
  });

  function label(u: Utterance): string {
    if (u.status === 'pending') return 'in de wachtrij';
    if (u.status === 'processing') return u.transcript === undefined ? 'verstaan…' : 'bezig…';
    if (u.status === 'failed') return 'fout';
    if (u.kind === 'dev_note') return 'feedback';
    if (u.result === 'ignored') return 'niet begrepen';
    return u.result === 'uncertain' ? 'onzeker' : 'verwerkt';
  }
</script>

{#if $last}
  {@const u = $last}
  <section class="last" aria-live="polite">
    {#if u.audio}
      <button
        class="play"
        onclick={() => toggle(u)}
        aria-label={playingId === u.id ? 'Opname pauzeren' : 'Laatste opname afspelen'}
        >{playingId === u.id ? PAUSE : PLAY}</button
      >
    {/if}
    <button
      class="text"
      class:open
      aria-expanded={open}
      aria-label="Laatst verstaan: {u.transcript ?? ''} ({label(u)})"
      onclick={() => (open = !open)}
    >
      <span class="status {u.result}">{label(u)}</span>
      <span class="said"
        >{u.transcript !== undefined ? `“${u.transcript}”` : 'Laatst verstaan'}</span
      >
    </button>
  </section>
{/if}

<style>
  /* In de vaste balk onderaan (ActiveSession.svelte), die zelf geen tikken
     doorlaat; diens regel voor de kinderen geldt niet voor een component */
  .last {
    box-sizing: border-box;
    width: 100%;
    max-width: 30rem;
    min-width: 0;
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.25rem;
    border: 1px solid var(--border);
    border-radius: 1.5rem;
    background: var(--surface);
  }

  .play {
    flex: none;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--brand-strong);
    font-size: 1.1rem;
  }

  .text {
    flex: 1;
    min-width: 0;
    min-height: 2.75rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem 0.25rem 0.25rem;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
  }

  .said {
    min-width: 0;
    font-size: 1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .text.open .said {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .status {
    flex: none;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .status.uncertain,
  .status.ignored {
    color: var(--amber);
  }
</style>
