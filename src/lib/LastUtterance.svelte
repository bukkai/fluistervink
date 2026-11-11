<script lang="ts">
  // "Wat zei ik?" (ontwikkeloptie, devOptions.ts): op het sessiescherm de
  // laatste uitspraak met wat de spraakherkenning verstond, en een knop om
  // de opname te horen. Zo zie je in het veld waarom iets misging ("hier"
  // in plaats van "vier") en kun je meteen verbeteren.
  import { liveQuery } from 'dexie';
  import { audioBlob, db, type Utterance } from './db';

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
  const PLAY = '▶︎';
  const PAUSE = '⏸︎';

  function stop() {
    audio?.pause();
    if (url) URL.revokeObjectURL(url);
    audio = url = undefined;
    playingId = undefined;
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
    audio.onplay = () => (playingId = u.id);
    audio.onended = stop;
    audio.play();
  }

  $effect(() => stop);

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
  <section class="card last" aria-live="polite">
    {#if u.audio}
      <button
        class="play"
        onclick={() => toggle(u)}
        aria-label={playingId === u.id ? 'Opname pauzeren' : 'Laatste opname afspelen'}
        >{playingId === u.id ? PAUSE : PLAY}</button
      >
    {/if}
    <p>
      <span class="muted">Laatst verstaan</span>
      {#if u.transcript !== undefined}
        <span class="said">“{u.transcript}”</span>
      {/if}
      <span class="status {u.result}">{label(u)}</span>
    </p>
  </section>
{/if}

<style>
  .last {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
  }

  .play {
    flex: none;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--brand-strong);
    font-size: 1.1rem;
  }

  p {
    margin: 0;
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }

  .said {
    font-size: 1.05rem;
    overflow-wrap: anywhere;
  }

  .muted {
    font-size: 0.8rem;
    color: var(--muted);
  }

  .status {
    font-size: 0.8rem;
    color: var(--muted);
  }

  .status.uncertain,
  .status.ignored {
    color: var(--amber);
  }
</style>
