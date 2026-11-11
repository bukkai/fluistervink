<script lang="ts">
  // Onopvallend onderin: een smal balkje terwijl een nieuwe versie binnenkomt,
  // en na het herladen even "Bijgewerkt naar versie …". Niet tijdens een
  // sessie: dan staat daar de inspreekknop.
  import { updateStatus } from './updateMelding.svelte';

  let { hidden = false }: { hidden?: boolean } = $props();

  // De melding na tien seconden weg, of meteen bij "Wat is er nieuw?"
  $effect(() => {
    if (!updateStatus.updatedTo) return;
    const timer = setTimeout(() => (updateStatus.updatedTo = ''), 10_000);
    return () => clearTimeout(timer);
  });

  function dismiss() {
    updateStatus.updatedTo = '';
  }
</script>

<div class="update" role="status" aria-live="polite">
  {#if hidden}
    <!-- Tijdens een sessie niets -->
  {:else if updateStatus.loading}
    <p class="pill">
      <span class="bar" aria-hidden="true"></span>
      Nieuwe versie laden…
    </p>
  {:else if updateStatus.updatedTo}
    <p class="pill">
      Bijgewerkt naar versie {updateStatus.updatedTo} ·
      <a class="link" href="#nieuw" onclick={dismiss}>Wat is er nieuw?</a>
    </p>
  {/if}
</div>

<style>
  .update {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(1rem + env(safe-area-inset-bottom));
    display: flex;
    justify-content: center;
    padding: 0 1rem;
    pointer-events: none;
    z-index: 5;
  }

  .pill {
    position: relative;
    overflow: hidden;
    margin: 0;
    padding: 0.4rem 0.9rem;
    font-size: 0.8rem;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    pointer-events: auto;
  }

  .pill .link {
    font-size: inherit;
  }

  /* Dun balkje langs de onderkant dat heen en weer loopt */
  .bar {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 40%;
    height: 2px;
    background: var(--brand);
    animation: slide 1.2s ease-in-out infinite alternate;
  }

  @keyframes slide {
    from {
      transform: translateX(-20%);
    }
    to {
      transform: translateX(170%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar {
      animation: none;
      width: 100%;
      opacity: 0.5;
    }
  }
</style>
