import { describe, expect, it } from 'vitest';
import { hasRarity, rarityFill, rarityShape, raritySvg } from './rarity';

describe('rarity', () => {
  it('kent alleen de niveaus 1 tot en met 4', () => {
    expect([0, 1, 4, 5].map(hasRarity)).toEqual([false, true, true, false]);
  });

  it('geeft onbekend een eigen vorm en kleur, niet die van algemeen', () => {
    expect(rarityShape(0)).not.toBe(rarityShape(1));
    expect(rarityFill(0)).not.toBe(rarityFill(1));
    expect(rarityFill(3)).toBe('var(--rarity-3)');
  });

  it('zet de kleur in style, niet in het fill-attribuut', () => {
    const svg = raritySvg(2, 'pin');
    expect(svg).toContain('style="fill: var(--rarity-2)"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toMatch(/ fill="/);
  });
});
