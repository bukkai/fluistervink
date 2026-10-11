<script lang="ts">
  // Zeldzaamheid zoals waarneming.nl die toont: kleur én vorm, zodat het ook
  // zonder kleurenzien te onderscheiden is. 0 = onbekend (verzamelsoorten).

  let { rarity }: { rarity: number } = $props();

  const labels = ['', 'algemeen', 'vrij algemeen', 'zeldzaam', 'zeer zeldzaam'];
</script>

{#if rarity >= 1 && rarity <= 4}
  <svg class="mark r{rarity}" viewBox="0 0 12 12" role="img" aria-label={labels[rarity]}>
    <title>{labels[rarity]}</title>
    {#if rarity === 1}
      <circle cx="6" cy="6" r="4.5" />
    {:else if rarity === 2}
      <rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1" />
    {:else if rarity === 3}
      <path d="M6 0.5 11.5 6 6 11.5 0.5 6Z" />
    {:else}
      <path d="M6 0.3 7.6 4.1 11.7 4.4 8.6 7.1 9.5 11.1 6 9 2.5 11.1 3.4 7.1 0.3 4.4 4.4 4.1Z" />
    {/if}
  </svg>
{:else}
  <span class="mark"></span>
{/if}

<style>
  .mark {
    display: inline-block;
    flex: none;
    width: 0.75rem;
    height: 0.75rem;
  }

  .r1 {
    fill: var(--rarity-1);
  }
  .r2 {
    fill: var(--rarity-2);
  }
  .r3 {
    fill: var(--rarity-3);
  }
  .r4 {
    fill: var(--rarity-4);
  }
</style>
