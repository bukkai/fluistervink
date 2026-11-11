<script lang="ts">
  // Ontwikkelopties: alleen voor de eigenaar (devOptions.ts)
  import { devOptionOn, setDevOption } from './devOptions';
  import { setShortcut, shortcutSupported, speechSupported } from './native';

  let shortcut = $state(devOptionOn('snelkoppeling'));
  let spoken = $state(devOptionOn('gesproken'));

  function toggleShortcut() {
    setDevOption('snelkoppeling', shortcut);
    setShortcut(shortcut);
  }
</script>

<section class="card">
  <div class="card-head"><h2>Ontwikkelopties</h2></div>
  <div class="card-body stack">
    <p class="hint">Nieuwe functies om eerst zelf te proberen. Alleen jij ziet dit.</p>
    {#if speechSupported}
      <label class="check">
        <input
          type="checkbox"
          bind:checked={spoken}
          onchange={() => setDevOption('gesproken', spoken)}
        />
        Gesproken bevestiging in de oortjes
      </label>
      <p class="hint">
        Na het trillen zegt de app wat hij heeft vastgelegd ("houtduif, 6, overvliegend"). Alleen
        als er oortjes of een headset aan zitten, nooit via de luidspreker. Een podcast gaat even
        zachter.
      </p>
    {/if}
    {#if shortcutSupported}
      <label class="check">
        <input type="checkbox" bind:checked={shortcut} onchange={toggleShortcut} />
        Snelkoppeling "Begin met vogelen"
      </label>
      <p class="hint">
        Lang drukken op het pictogram van de app (of de snelkoppeling op je beginscherm slepen)
        start meteen een sessie.
      </p>
    {/if}
    {#if !shortcutSupported && !speechSupported}
      <p class="hint">Nog niets voor deze app-versie.</p>
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
</style>
