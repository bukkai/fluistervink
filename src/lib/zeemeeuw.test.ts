import { describe, expect, it } from 'vitest';
import { mentionsZeemeeuw } from './zeemeeuw.svelte';

describe('zeemeeuw (easter egg)', () => {
  it('herkent de zeemeeuw in allerlei spellingen', () => {
    for (const text of ['Zeemeeuw', 'drie zeemeeuwen overvliegend', 'zee-meeuw', 'Zee meeuw'])
      expect(mentionsZeemeeuw(text)).toBe(true);
  });

  it('laat echte meeuwen met rust', () => {
    for (const text of ['zilvermeeuw', 'twee kokmeeuwen', 'zee-eend', 'meeuw spec'])
      expect(mentionsZeemeeuw(text)).toBe(false);
  });
});
