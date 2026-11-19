<script lang="ts">
  import { t } from './i18n';
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
  <strong>{t('stillBirding.title')}</strong>
  <p>{t('stillBirding.text', { moment: formatMoment(lastActivityAt) })}</p>
  <div class="buttons">
    <button class="btn" onclick={onkeep}>{t('stillBirding.keep')}</button>
    <button class="btn secondary" onclick={onstop}>{t('stillBirding.stop')}</button>
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
