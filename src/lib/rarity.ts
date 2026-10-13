// Zeldzaamheid zoals waarneming.nl die toont: kleur én vorm, zodat het ook
// zonder kleurenzien te onderscheiden is. 0 = onbekend (verzamelsoorten).
// Gedeeld door de lijst (RarityMark.svelte) en de kaart.

export const rarityLabels = ['', 'algemeen', 'vrij algemeen', 'zeldzaam', 'zeer zeldzaam'];

/** Vorm per niveau, in een viewBox van 12 × 12 */
const SHAPES = [
  '<circle cx="6" cy="6" r="4.5" />',
  '<rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1" />',
  '<path d="M6 0.5 11.5 6 6 11.5 0.5 6Z" />',
  '<path d="M6 0.3 7.6 4.1 11.7 4.4 8.6 7.1 9.5 11.1 6 9 2.5 11.1 3.4 7.1 0.3 4.4 4.4 4.1Z" />',
];

/** Onbekend (alleen op de kaart): een kleiner grijs stipje, anders dan het rondje van "algemeen" */
const UNKNOWN_SHAPE = '<circle cx="6" cy="6" r="3" />';
const UNKNOWN_FILL = '#6f7587';

export function hasRarity(rarity: number): boolean {
  return rarity >= 1 && rarity <= 4;
}

/** SVG-vorm voor dit niveau */
export function rarityShape(rarity: number): string {
  return hasRarity(rarity) ? SHAPES[rarity - 1] : UNKNOWN_SHAPE;
}

export function rarityFill(rarity: number): string {
  return hasRarity(rarity) ? `var(--rarity-${rarity})` : UNKNOWN_FILL;
}

/**
 * Het vormpje als SVG-tekst, voor plekken buiten Svelte (Leaflet). Decoratief:
 * de naam van de soort staat ernaast of in de titel van de stip.
 */
export function raritySvg(rarity: number, className: string): string {
  return (
    `<svg class="${className}" viewBox="-1 -1 14 14" aria-hidden="true" ` +
    `style="fill: ${rarityFill(rarity)}">${rarityShape(rarity)}</svg>`
  );
}
