import { describe, expect, it } from 'vitest';
import { getSpecies, isPromptSpecies } from './vocab';

describe('getSpecies', () => {
  it('geeft voor een vervangen ID de nieuwe soort', () => {
    // Bonte Kraai was soort 67, nu een ondersoort van de Zwarte Kraai
    expect(getSpecies(67)).toMatchObject({
      id: 255102,
      name: 'Bonte Kraai',
      scientific: 'Corvus corone cornix',
    });
    expect(isPromptSpecies(255102)).toBe(true);
  });

  it('volgt de wetenschappelijke naam van waarneming.nl', () => {
    expect(getSpecies(199)?.scientific).toBe('Nannus troglodytes');
  });
});
