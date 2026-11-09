import { describe, expect, it } from 'vitest';
import { editDistance, findVagrant, getSpecies, isPromptSpecies, isVagrant } from './vocab';

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

describe('findVagrant', () => {
  const ROODKOPKLAUWIER = 53;
  const KUIFKOEKOEK = 966;

  it('vindt een dwaalgast op Nederlandse of wetenschappelijke naam', () => {
    expect(findVagrant('roodkopklauwier')?.id).toBe(ROODKOPKLAUWIER);
    expect(findVagrant('Roodkop-klauwier')?.id).toBe(ROODKOPKLAUWIER);
    expect(findVagrant('Lanius senator')?.id).toBe(ROODKOPKLAUWIER);
    expect(findVagrant('kuifkoekoek')?.id).toBe(KUIFKOEKOEK);
    expect(isVagrant(KUIFKOEKOEK)).toBe(true);
    expect(isPromptSpecies(KUIFKOEKOEK)).toBe(false);
  });

  it('vergeeft een paar letters van de spraakherkenning', () => {
    expect(findVagrant('roodkop klauwir')?.id).toBe(ROODKOPKLAUWIER);
    expect(findVagrant('kuifkoekoeck')?.id).toBe(KUIFKOEKOEK);
  });

  it('kiest geen dwaalgast als een gewone soort minstens zo goed past', () => {
    // Grote Kruisbek is een dwaalgast, Kruisbek niet
    expect(findVagrant('kruisbek')).toBeUndefined();
    expect(findVagrant('roodborsttapuit')).toBeUndefined();
    expect(findVagrant('grauwe klauwier')).toBeUndefined();
  });

  it('geeft niets bij een naam die nergens op lijkt, of bij een kooivogel', () => {
    expect(findVagrant('albatros')).toBeUndefined();
    expect(findVagrant('')).toBeUndefined();
    // Roodkopgans: uitheems, zeldzaamheid 0 in de bron
    expect(findVagrant('roodkopgans')).toBeUndefined();
  });
});

describe('editDistance', () => {
  it('telt invoegen, weglaten en vervangen', () => {
    expect(editDistance('vink', 'vink')).toBe(0);
    expect(editDistance('vink', 'fink')).toBe(1);
    expect(editDistance('keep', 'kep')).toBe(1);
    expect(editDistance('abc', 'xyzabc', 2)).toBe(3);
  });
});
