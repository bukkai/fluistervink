import { describe, expect, it } from 'vitest';
import {
  allSpecies,
  codesFor,
  convertCodes,
  editDistance,
  findVagrant,
  getSpecies,
  groupOf,
  groups,
  isPromptSpecies,
  isVagrant,
  promptSpeciesOf,
  species,
} from './vocab';

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

describe('soortgroepen', () => {
  const TURKSE_TORTEL = 191;
  const REE = 418;
  const ATALANTA = 723;
  const BLOEDRODE_HEIDELIBEL = 640;
  const GEWONE_PAD = 442;

  it('kent de groep van elke soort', () => {
    expect(groupOf(TURKSE_TORTEL)).toBe(1);
    expect(groupOf(REE)).toBe(2);
    expect(groupOf(GEWONE_PAD)).toBe(3);
    expect(groupOf(ATALANTA)).toBe(4);
    expect(groupOf(BLOEDRODE_HEIDELIBEL)).toBe(5);
    expect(getSpecies(REE)?.name).toBe('Ree');
  });

  it('geeft het model en het formulier voorlopig alleen vogels', () => {
    expect(species.every((s) => s.group === 1)).toBe(true);
    expect(allSpecies.every((s) => s.group === 1)).toBe(true);
    expect(isPromptSpecies(REE)).toBe(false);
    expect(promptSpeciesOf(2).map((s) => s.name)).toContain('Ree');
  });

  it('zoekt geen dwaalgasten buiten de vogels', () => {
    expect(findVagrant('alpenmarmot')).toBeUndefined();
  });

  it('heeft per groep eigen codes, met ter plaatse en gezien als standaard', () => {
    for (const group of groups) {
      const { allActivities, allMethods, defaultActivity, defaultMethod } = group.codes;
      expect(allActivities.find((c) => c.id === defaultActivity)?.name).toBe('ter plaatse');
      expect(allMethods.find((c) => c.id === defaultMethod)?.name).toBe('gezien');
    }
    expect(codesFor(TURKSE_TORTEL).defaultActivity).toBe(1);
    expect(codesFor(REE).defaultActivity).toBe(15);
    expect(codesFor(ATALANTA).lifeStages.map((c) => c.name)).toContain('rups');
  });
});

describe('convertCodes', () => {
  const TURKSE_TORTEL = 191;
  const VELDLEEUWERIK = 192;
  const REE = 418;
  const VOS = 428;
  const ATALANTA = 723;

  it('laat de codes staan binnen dezelfde groep', () => {
    const fields = { activityId: 4, methodId: 49, lifeStageId: 5 };
    expect(convertCodes(fields, TURKSE_TORTEL, VELDLEEUWERIK)).toBe(fields);
    expect(convertCodes({ activityId: 16 }, REE, VOS)).toEqual({ activityId: 16 });
  });

  it('zet om op naam, anders naar ter plaatse en gezien', () => {
    // vogels: foeragerend 2, gezien 48, juveniel 5 → zoogdieren: 16, 123, 27
    expect(
      convertCodes({ activityId: 2, methodId: 48, lifeStageId: 5 }, TURKSE_TORTEL, REE),
    ).toEqual({
      activityId: 16,
      methodId: 123,
      lifeStageId: 27,
    });
    // zingend en eerste kalenderjaar bestaan niet bij zoogdieren; gehoord wel
    expect(
      convertCodes({ activityId: 4, methodId: 49, lifeStageId: 14 }, TURKSE_TORTEL, REE),
    ).toEqual({
      activityId: 15,
      methodId: 124,
      lifeStageId: undefined,
    });
  });

  it('kent namen die per groep anders heten', () => {
    // vondst (dood) → dood; adult → imago; overvliegend noord → overvliegend
    expect(convertCodes({ activityId: 17, lifeStageId: 2 }, TURKSE_TORTEL, ATALANTA)).toEqual({
      activityId: 23,
      lifeStageId: 29,
    });
    expect(convertCodes({ activityId: 11 }, TURKSE_TORTEL, REE)).toEqual({ activityId: 72 });
    // en terug: dood → vondst (dood)
    expect(convertCodes({ activityId: 18 }, REE, TURKSE_TORTEL)).toEqual({ activityId: 17 });
  });

  it('laat velden weg die er niet waren', () => {
    expect(convertCodes({}, TURKSE_TORTEL, REE)).toEqual({});
  });
});
