import { describe, expect, it } from 'vitest';
import { shieldText } from './format';

describe('shieldText', () => {
  it('is leeg bij een openbare waarneming', () => {
    expect(shieldText({})).toBe('');
    expect(shieldText({ obscurity: 0 })).toBe('');
  });

  it('noemt afscherming en embargo', () => {
    expect(shieldText({ obscurity: 9 })).toBe('Verborgen op waarneming.nl');
    expect(shieldText({ embargoUntil: '2027-03-01' })).toBe('Embargo tot 1 mrt 2027');
    expect(shieldText({ obscurity: 1, embargoUntil: '2027-03-01' })).toBe(
      'Vervaagd tot 1 km op waarneming.nl · embargo tot 1 mrt 2027',
    );
  });
});
