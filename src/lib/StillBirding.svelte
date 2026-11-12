<script lang="ts">
  import { formatMoment } from './format';

  // Vergeten te stoppen? Na een uur zonder uitspraken vraagt de app het bij
  // het openen (checkStaleSession in sessions.ts). Wat er daarna gebeurt,
  // regelt het hoofdscherm.
  let {
    lastActivityAt,
    onkeep,
    onstop,
  }: {
    /** Laatste uitspraak, of de start van de sessie */
    lastActivityAt: number;
    onkeep: () => void;
    onstop: () => void;
  } = $props();
</script>

<div class="still-birding card">
  <strong>Ben je nog aan het vogelen?</strong>
  <p>Sinds {formatMoment(lastActivityAt)} is er niets ingesproken.</p>
  <div class="buttons">
    <button class="btn" onclick={onkeep}>Ja, ga door</button>
    <button class="btn secondary" onclick={onstop}>Nee, stoppen</button>
  </div>
</div>

<style>
  .still-birding {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.9rem 1rem;
  }

  .still-birding p {
    margin: 0;
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
  }
</style>
