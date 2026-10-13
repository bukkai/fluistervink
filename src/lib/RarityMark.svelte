<script lang="ts">
  import { hasRarity, rarityLabels, raritySvg } from './rarity';

  // Zeldzaamheid als gekleurd vormpje, zie rarity.ts (zelfde vorm als op de kaart)

  let { rarity }: { rarity: number } = $props();
</script>

{#if hasRarity(rarity)}
  {@html raritySvg(rarity, 'rarity-mark', rarityLabels[rarity])}
{:else}
  <span class="rarity-mark"></span>
{/if}

<style>
  /* Global: de svg komt uit {@html}, daar komen Svelte's scoped classes niet bij */
  :global(.rarity-mark) {
    display: inline-block;
    flex: none;
    width: 0.75rem;
    height: 0.75rem;
  }
</style>
