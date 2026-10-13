import { getSpecies } from './vocab';

// Zeldzaamheid zoals waarneming.nl die toont: kleur én vorm, zodat het ook
// zonder kleurenzien te onderscheiden is. 0 = onbekend (verzamelsoorten).
// Gedeeld door de lijst (RarityMark.svelte) en de kaart. De kleuren staan als
// classes in app.css (.rarity-0 t/m .rarity-4), niet in een style-attribuut:
// dat laat de Content-Security-Policy niet toe (public/_headers).

export const rarityLabels = ['', 'algemeen', 'vrij algemeen', 'zeldzaam', 'zeer zeldzaam'];

/** Vorm per niveau, in een viewBox van 12 × 12; onbekend (alleen op de kaart) is een kleiner stipje */
const SHAPES = [
  '<circle cx="6" cy="6" r="3" />',
  '<circle cx="6" cy="6" r="4.5" />',
  '<rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1" />',
  '<path d="M6 0.5 11.5 6 6 11.5 0.5 6Z" />',
  '<path d="M6 0.3 7.6 4.1 11.7 4.4 8.6 7.1 9.5 11.1 6 9 2.5 11.1 3.4 7.1 0.3 4.4 4.4 4.1Z" />',
];

export function hasRarity(rarity: number): boolean {
  return rarity >= 1 && rarity <= 4;
}

/** Zeldzaamheid van een soort; 0 als die onbekend is */
export function rarityOf(speciesId: number): number {
  return getSpecies(speciesId)?.rarity ?? 0;
}

/**
 * Het vormpje als SVG-tekst (alleen uit vaste waarden opgebouwd). Met `label`
 * een plaatje met die naam voor schermlezers; zonder is het decoratief, omdat
 * de naam van de soort ernaast of in de titel van de stip staat.
 */
export function raritySvg(rarity: number, className: string, label?: string): string {
  const level = hasRarity(rarity) ? rarity : 0;
  const a11y = label
    ? `role="img" aria-label="${label}"><title>${label}</title`
    : 'aria-hidden="true"';
  return (
    `<svg class="${className} rarity-${level}" viewBox="0 0 12 12" ${a11y}>` +
    `${SHAPES[level]}</svg>`
  );
}
