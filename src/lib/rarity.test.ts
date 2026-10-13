import { describe, expect, it } from 'vitest';
import { hasRarity, raritySvg } from './rarity';

describe('rarity', () => {
  it('kent alleen de niveaus 1 tot en met 4', () => {
    expect([0, 1, 4, 5].map(hasRarity)).toEqual([false, true, true, false]);
  });

  it('geeft onbekend een eigen vorm en kleur, niet die van algemeen', () => {
    const unknown = raritySvg(0, 'pin');
    const common = raritySvg(1, 'pin');
    expect(unknown).toContain('rarity-0');
    expect(unknown.replace('rarity-0', '')).not.toBe(common.replace('rarity-1', ''));
  });

  it('zet de kleur in een class, niet in een style-attribuut (CSP)', () => {
    const svg = raritySvg(2, 'pin');
    expect(svg).toContain('class="pin rarity-2"');
    expect(svg).not.toMatch(/style=|fill=/);
  });

  it('is decoratief zonder label, en een benoemd plaatje met label', () => {
    expect(raritySvg(3, 'pin')).toContain('aria-hidden="true"');
    expect(raritySvg(3, 'mark', 'zeldzaam')).toContain(
      'role="img" aria-label="zeldzaam"><title>zeldzaam</title>',
    );
  });
});
