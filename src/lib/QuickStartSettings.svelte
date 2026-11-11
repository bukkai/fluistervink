<script lang="ts">
  // Snel een sessie beginnen: snelkoppeling op het pictogram en de tegel in de
  // snelle instellingen (alleen in de Android-app; SnelkoppelingPlugin.java)
  import { requestTile } from './native';

  let busy = $state(false);
  let message = $state('');

  async function addTile() {
    busy = true;
    const result = await requestTile();
    busy = false;
    message = {
      toegevoegd: 'De tegel staat erbij.',
      stond_er_al: 'De tegel stond er al.',
      niet_toegevoegd: 'Niet toegevoegd.',
      niet_mogelijk:
        'Dat kan hier niet vanuit de app. Veeg van boven naar beneden, tik op het potloodje en sleep "Begin met vogelen" erbij.',
    }[result];
  }
</script>

<section class="card">
  <div class="card-head"><h2>Snel beginnen</h2></div>
  <div class="card-body stack">
    <p class="hint">
      Houd het pictogram van Fluistervink ingedrukt en kies "Begin met vogelen": dan start meteen
      een sessie. Dat kan ook met een tegel in de snelle instellingen (van boven naar beneden
      vegen), vanuit elke app.
    </p>
    <button class="btn secondary block" disabled={busy} onclick={addTile}> Tegel toevoegen </button>
    {#if message}
      <p class="hint" role="status">{message}</p>
    {/if}
  </div>
</section>

<style>
  .stack {
    display: grid;
    gap: 0.75rem;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
