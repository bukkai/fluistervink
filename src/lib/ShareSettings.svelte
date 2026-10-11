<script lang="ts">
  // Delen met de ontwikkelaar aan/uit, met of zonder opnames, en handmatig
  // versturen. Zie share.ts; de eerste keuze vraagt het hoofdscherm.
  import {
    lastSharedAt,
    setShareAudio,
    setShareEnabled,
    shareAudio,
    shareEnabled,
    shareNow,
  } from './share';

  let sharing = $state(shareEnabled());
  let sharingAudio = $state(shareAudio());
  let sharedAt = $state(lastSharedAt());
  let shareStatus = $state<'idle' | 'busy' | 'error'>('idle');
  let shareMessage = $state('');

  async function shareManually() {
    shareStatus = 'busy';
    try {
      const { sessions, audio } = await shareNow();
      shareStatus = 'idle';
      sharedAt = lastSharedAt();
      shareMessage =
        sessions || audio
          ? [
              sessions && `${sessions === 1 ? '1 wandeling' : `${sessions} wandelingen`}`,
              audio && `${audio === 1 ? '1 opname' : `${audio} opnames`}`,
            ]
              .filter(Boolean)
              .join(' en ') + ' verstuurd.'
          : 'Alles was al verstuurd.';
    } catch (error) {
      shareStatus = 'error';
      shareMessage = `Versturen mislukt: ${error instanceof Error ? error.message : error}`;
    }
  }

  const sharedAtFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<section class="card">
  <div class="card-head"><h2>Delen met de ontwikkelaar</h2></div>
  <div class="card-body stack">
    <p class="hint">
      Na elke wandeling gaan de uitspraken, wat de app ervan maakte, je correcties bij het nalopen
      en je feedback naar de ontwikkelaar, om de herkenning te verbeteren. Ook de locaties van je
      waarnemingen. Zie <a href="#privacy">Privacy</a>.
    </p>
    <label class="check">
      <input type="checkbox" bind:checked={sharing} onchange={() => setShareEnabled(sharing)} />
      Wandelingen en feedback delen
    </label>
    <label class="check">
      <input
        type="checkbox"
        bind:checked={sharingAudio}
        disabled={!sharing}
        onchange={() => setShareAudio(sharingAudio)}
      />
      Ook de opnames (helpt om de spraakherkenning te vergelijken)
    </label>
    {#if sharing}
      <button class="btn secondary block" disabled={shareStatus === 'busy'} onclick={shareManually}>
        {shareStatus === 'busy' ? 'Bezig…' : 'Nu versturen'}
      </button>
      <p class="hint" class:error={shareStatus === 'error'}>
        {shareMessage ||
          (sharedAt ? `Laatst verstuurd: ${sharedAtFormat.format(sharedAt)}.` : 'Nog niets verstuurd.')}
      </p>
    {/if}
  </div>
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .hint a {
    color: inherit;
  }

  .error {
    color: var(--red);
  }
</style>
