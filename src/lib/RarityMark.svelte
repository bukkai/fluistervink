<script lang="ts">
  import { hasRarity, rarityFill, rarityLabels, rarityShape } from './rarity';

  // Zeldzaamheid als gekleurd vormpje, zie rarity.ts

  let { rarity }: { rarity: number } = $props();
</script>

{#if hasRarity(rarity)}
  <svg
    class="mark"
    viewBox="0 0 12 12"
    role="img"
    aria-label={rarityLabels[rarity]}
    style:fill={rarityFill(rarity)}
  >
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
</style>
