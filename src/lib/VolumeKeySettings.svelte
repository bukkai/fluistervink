<script lang="ts">
  // Volumeknop als inspreekknop (alleen in de Android-app, zie volumeKey.ts)
  import { setVolumeKeyEnabled, volumeKeyEnabled } from './volumeKey';

  let enabled = $state(volumeKeyEnabled());

  function toggle() {
    setVolumeKeyEnabled(enabled);
  }
</script>

<section class="card">
  <div class="card-head"><h2>Volumeknop</h2></div>
  <div class="card-body stack">
    <label class="check">
      <input type="checkbox" bind:checked={enabled} onchange={toggle} />
      Volumeknop als inspreekknop (proef)
    </label>
    <p class="hint">
      Tijdens een sessie start een druk op de volumeknop (omhoog of omlaag) een opname, en de
      volgende druk stopt hem. Handig met handschoenen of met de verrekijker in je andere hand. Een
      Bluetooth-knopje voor selfies werkt ook zo.
    </p>
    <p class="hint">
      Het volume regel je tijdens een sessie dan niet met die knop. Werkt alleen met de app op het
      scherm, niet met het scherm uit.
    </p>
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
