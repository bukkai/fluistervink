<script lang="ts">
  import { hasRarity, rarityLabels, rarityShape } from './rarity';

  // Zeldzaamheid als gekleurd vormpje, zie rarity.ts

  let { rarity }: { rarity: number } = $props();
</script>

{#if hasRarity(rarity)}
  <svg class="mark r{rarity}" viewBox="0 0 12 12" role="img" aria-label={rarityLabels[rarity]}>
    <title>{rarityLabels[rarity]}</title>
    {@html rarityShape(rarity)}
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
