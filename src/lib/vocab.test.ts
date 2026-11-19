import { describe, expect, it } from 'vitest';
import {
  activityNameIn,
  aliases,
  aliasesOf,
  allSpecies,
  codesFor,
  convertCodes,
  countingMethodNameIn,
  editDistance,
  findVagrant,
  getSpecies,
  groupOf,
  groupOfCode,
  groups,
  heardNames,
  isPromptSpecies,
  isVagrant,
  lifeStageNameIn,
  methodNameIn,
  promptSpeciesOf,
  searchSpecies,
  species,
  speciesNameIn,
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

  describe('andere dieren', () => {
    const WOLF = 70056;
    const KNOFLOOKPAD = 449;
    const HAMSTER = 402;

    it('vindt een zeldzaam ander dier alleen met de andere soortgroepen aan', () => {
      expect(findVagrant('wolf', true)?.id).toBe(WOLF);
      expect(findVagrant('knoflookpad', true)?.id).toBe(KNOFLOOKPAD);
      expect(findVagrant('Pelobates fuscus', true)?.id).toBe(KNOFLOOKPAD);
      expect(isVagrant(WOLF)).toBe(true);
      expect(findVagrant('wolf')).toBeUndefined();
      expect(findVagrant('knoflookpad')).toBeUndefined();
    });

    it('vindt een dwaalgast ook op een bijnaam die niet in de prompt staat', () => {
      expect(findVagrant('korenwolf', true)?.id).toBe(HAMSTER);
      expect(findVagrant('Korenwolf', true)?.id).toBe(HAMSTER);
    });

    it('vindt een dwaalgast ook in het meervoud', () => {
      expect(findVagrant('korenwolven', true)?.id).toBe(HAMSTER);
      expect(findVagrant('knoflookpadden', true)?.id).toBe(KNOFLOOKPAD);
      expect(findVagrant('wolven', true)?.id).toBe(WOLF);
      expect(findVagrant('roodkopklauwieren')?.id).toBe(ROODKOPKLAUWIER);
      // Het enkelvoud is een gewone soort: geen dwaalgast
      expect(findVagrant('kruisbekken')).toBeUndefined();
      expect(aliases.some((a) => a.soort === HAMSTER)).toBe(false);
      expect(aliasesOf(2).some((a) => a.soort === HAMSTER)).toBe(false);
    });

    it('kiest geen zeldzaam dier als een dier uit de prompt minstens zo goed past', () => {
      // Boommarter staat in de prompt
      expect(findVagrant('boommarter', true)).toBeUndefined();
      expect(findVagrant('ree', true)).toBeUndefined();
    });

    it('vindt nog steeds vogels met de andere soortgroepen aan', () => {
      expect(findVagrant('roodkopklauwier', true)?.id).toBe(ROODKOPKLAUWIER);
    });
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

  it('zoekt zonder de andere soortgroepen geen dwaalgasten buiten de vogels', () => {
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

describe('groupOfCode', () => {
  it('de korte lijsten van de groepen hebben geen ID gemeen', () => {
    for (const field of ['activities', 'methods', 'lifeStages'] as const) {
      const ids = groups.flatMap((g) => g.codes[field].map((c) => c.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('vindt de groep van een code uit de prompt', () => {
    expect(groupOfCode('activityId', 1)).toBe(1);
    expect(groupOfCode('activityId', 15)).toBe(2);
    expect(groupOfCode('lifeStageId', 23)).toBe(4);
    expect(groupOfCode('methodId', 999999)).toBeUndefined();
  });
});

describe('searchSpecies', () => {
  const names = (query: string) => searchSpecies(allSpecies, query).map((s) => s.name);

  it('zet namen die met de tekst beginnen voorop, algemene soorten eerst', () => {
    const found = names('noordse');
    expect(found.every((n) => n.startsWith('Noordse'))).toBe(true);
    expect(found.indexOf('Noordse Stern')).toBeLessThan(found.indexOf('Noordse Boszanger'));
  });

  it('vindt een woord in de naam vóór een stukje van een woord', () => {
    const found = names('kievit');
    expect(found[0]).toBe('Kievit');
    expect(found.indexOf('Indische Kievit')).toBeLessThan(found.indexOf('Steppekievit'));
  });

  it('negeert hoofdletters en spaties eromheen', () => {
    expect(names('  GRUTTO ')[0]).toBe('Grutto');
  });

  it('vindt de wetenschappelijke naam', () => {
    expect(names('fringilla coelebs')).toEqual(['Vink']);
  });

  it('geeft niets bij een leeg veld en hooguit het maximum', () => {
    expect(names('  ')).toEqual([]);
    expect(searchSpecies(allSpecies, 'e', 5)).toHaveLength(5);
  });
});

describe('bijnamen', () => {
  it('kent verhaspelingen van de spraakherkenning, maar niet als bijnaam', () => {
    // "goudborstje" voor roodborstje: wel naar het model, niet in de prompt van
    // de spraakherkenning (die krijgt alleen de bijnamen)
    const roodborst = aliases.find((a) => a.naam === 'Roodborst')!;
    expect(roodborst.soort).toBe(168);
    expect(heardNames(roodborst)).toContain('goudborstje');
    expect(aliases.flatMap((a) => a.bijnamen)).not.toContain('goudborst');
  });
});

describe('soortenlijst', () => {
  it('heeft de Chileense Flamingo, een exoot die hier geregeld voorkomt', () => {
    expect(isPromptSpecies(238)).toBe(true);
    expect(isVagrant(238)).toBe(false);
  });
});

describe('namen in een andere taal', () => {
  it('geeft de Engelse naam van een soort, op ID', () => {
    expect(speciesNameIn('en', 136)).toBe('Mute Swan');
    expect(speciesNameIn('nl', 136)).toBe('Knobbelzwaan');
  });

  it('volgt een vervangen ID', () => {
    // Bonte Kraai was soort 67
    expect(speciesNameIn('en', 67)).toBe('Hooded Crow');
  });

  it('valt terug op de wetenschappelijke naam, en op het ID als de soort onbekend is', () => {
    expect(speciesNameIn('en', 999_999_999)).toBe('species 999999999');
    expect(speciesNameIn('nl', 999_999_999)).toBe('soort 999999999');
  });

  it('heeft een Engelse naam voor elke soort die het model kan kiezen, in elke groep', () => {
    // Verzamelsoorten ("Accipiter spec.") hebben in de bron vaak geen Engelse naam
    for (const group of groups)
      for (const s of promptSpeciesOf(group.id).filter((s) => s.type === 'S'))
        expect(speciesNameIn('en', s.id), s.name).not.toBe(s.scientific);
  });

  it('geeft gedrag, methode en kleed in de codes van de groep van de soort', () => {
    const merel = 150;
    const ree = 418;
    expect(activityNameIn('en', merel, 6)).toBe('flying over');
    expect(activityNameIn('nl', merel, 6)).toBe('overvliegend');
    expect(methodNameIn('en', merel, 49)).toBe('heard');
    expect(lifeStageNameIn('en', merel, 5)).toBe('juvenile');
    // Bij zoogdieren is "ter plaatse" 15 en "gezien" 123
    expect(activityNameIn('en', ree, 15)).toBe('present');
    expect(methodNameIn('en', ree, 123)).toBe('seen');
    expect(activityNameIn('en', merel, undefined)).toBeUndefined();
  });

  it('heeft een Engelse naam voor elke code van elke groep', () => {
    for (const group of groups) {
      const s = promptSpeciesOf(group.id)[0];
      const { allActivities, allMethods, allLifeStages } = codesFor(s.id);
      for (const c of allActivities) expect(activityNameIn('en', s.id, c.id), c.name).toBeTruthy();
      for (const c of allMethods) expect(methodNameIn('en', s.id, c.id), c.name).toBeTruthy();
      for (const c of allLifeStages) expect(lifeStageNameIn('en', s.id, c.id), c.name).toBeTruthy();
    }
  });

  it('geeft de telmethode', () => {
    expect(countingMethodNameIn('en', 6)).toBe('estimated');
    expect(countingMethodNameIn('en', 2)).toBe('real count');
    expect(countingMethodNameIn('nl', 6)).toBe('schatting');
    expect(countingMethodNameIn('en', undefined)).toBeUndefined();
  });
});
