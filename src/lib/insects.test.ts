import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import insectData from '../../data/soorten-insecten.json';
import { toolResponse } from '../test-helpers';
import { parseResponse } from './interpret';
import { toolsFor, variant } from './prompt';
import {
  findInsect,
  findPromptSpecies,
  getSpecies,
  groupOf,
  groupOfCode,
  groups,
  insectGroups,
  isPromptSpecies,
  registerInsects,
  selectableSpecies,
  setInsectsEnabled,
  speciesNameIn,
  type InsectSpecies,
} from './vocab';

// Insecten (docs/plan-insecten.md, laag 1): in de prompt alleen
// verzamelsoorten; een gezegde soortnaam zoekt de app op in de groep van de
// verzamelsoort die het model koos. Alles alleen met de ontwikkeloptie.

const KEVER_ONBEKEND = 27916;
const HOMMEL_ONBEKEND = 105323;
const NACHTVLINDER_ONBEKEND = 9059;
const GOUDHAANTJE_KEVER = 22578;
const VLIEGEND_HERT = 1660;
const AARDHOMMEL = 1803;
const RIETVINK_VLINDER = 1493;

beforeAll(() => registerInsects(insectData as InsectSpecies[]));
afterEach(() => setInsectsEnabled(false));

describe('gegevens', () => {
  it('heeft per insectengroep verzamelsoorten en een lijst om op te zoeken', () => {
    for (const g of insectGroups) {
      const inGroup = (insectData as InsectSpecies[]).filter((s) => s.group === g.id);
      expect(inGroup.length, g.name).toBeGreaterThan(10);
    }
    expect(groupOf(KEVER_ONBEKEND)).toBe(16);
    expect(getSpecies(VLIEGEND_HERT)?.name).toBe('Vliegend hert');
    expect(speciesNameIn('en', VLIEGEND_HERT)).toBe('Stag Beetle');
  });

  it('de korte lijsten van alle groepen, ook de insecten, hebben geen ID gemeen', () => {
    for (const field of ['activities', 'methods', 'lifeStages'] as const) {
      const ids = [...groups, ...insectGroups].flatMap((g) => g.codes[field].map((c) => c.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(groupOfCode('activityId', 94)).toBe(16);
  });
});

describe('findInsect', () => {
  it('vindt een soort binnen de groep, ook in het meervoud en met een tikfout', () => {
    expect(findInsect('goudhaantje', 16)?.id).toBe(GOUDHAANTJE_KEVER);
    expect(findInsect('vliegend hert', 16)?.id).toBe(VLIEGEND_HERT);
    expect(findInsect('aardhommels', 17)?.id).toBe(AARDHOMMEL);
    expect(findInsect('aardhomel', 17)?.id).toBe(AARDHOMMEL);
    expect(findInsect('Lucanus cervus', 16)?.id).toBe(VLIEGEND_HERT);
    expect(findInsect('rietvink', 8)?.id).toBe(RIETVINK_VLINDER);
  });

  it('zoekt alleen in de genoemde groep, en niet bij vogels', () => {
    expect(findInsect('aardhommel', 16)).toBeUndefined();
    expect(findInsect('rietvink', 1)).toBeUndefined();
  });

  it('kent de Engelse namen', () => {
    expect(findInsect('Stag Beetle', 16, 'en')?.id).toBe(VLIEGEND_HERT);
    expect(findInsect('Buff-tailed Bumblebees', 17, 'en')?.id).toBe(AARDHOMMEL);
  });
});

describe('prompt en soortkeuze', () => {
  it('zet de insecten alleen met de ontwikkeloptie in prompt en tools', () => {
    expect(variant(true).system).not.toContain('## Insecten');
    expect(isPromptSpecies(KEVER_ONBEKEND, true)).toBe(false);
    expect(findPromptSpecies('Kever onbekend', true)).toBeUndefined();
    const enumOf = () =>
      (toolsFor(true)[0].input_schema.properties as Record<string, { enum?: number[] }>).activity_id
        .enum;
    expect(enumOf()).not.toContain(94);

    setInsectsEnabled(true);
    expect(variant(true).system).toContain('## Insecten');
    expect(variant(true).system).toContain(`${KEVER_ONBEKEND}|Kever onbekend|`);
    expect(variant(true, 'en').system).toContain('## Insects');
    expect(variant(false).system).not.toContain('## Insecten');
    expect(isPromptSpecies(KEVER_ONBEKEND, true)).toBe(true);
    expect(isPromptSpecies(KEVER_ONBEKEND, false)).toBe(false);
    expect(enumOf()).toContain(94);
    // Elke variant heeft een eigen promptversie
    expect(variant(true)).not.toBe((setInsectsEnabled(false), variant(true)));
  });

  it('heeft de insecten alleen met de ontwikkeloptie in het soortveld', () => {
    expect(selectableSpecies(true).some((s) => s.id === VLIEGEND_HERT)).toBe(false);
    expect(selectableSpecies(true).some((s) => s.id === KEVER_ONBEKEND)).toBe(false);
    setInsectsEnabled(true);
    expect(selectableSpecies(true).some((s) => s.id === VLIEGEND_HERT)).toBe(true);
    expect(selectableSpecies(false).some((s) => s.id === VLIEGEND_HERT)).toBe(false);
  });
});

describe('parseResponse met insecten', () => {
  const kever = (fields: Record<string, unknown> = {}) =>
    toolResponse([
      'add_observation',
      {
        species_name: 'Kever onbekend',
        species_id: KEVER_ONBEKEND,
        count: 1,
        activity_id: 94,
        method_id: 473,
        uncertain: true,
        uncertain_reason: 'Gezegd: goudhaantje (niet in de lijst)',
        ...fields,
      },
    ]);

  it('zoekt "goudhaantje, de kever" op bij de kevers (feedback 20 nov)', () => {
    setInsectsEnabled(true);
    const { actions, rejected, warnings } = parseResponse(
      kever({ unlisted_species: 'goudhaantje' }),
      [],
      true,
    );
    expect(rejected).toEqual([]);
    expect(warnings).toEqual([]);
    expect(actions[0]).toMatchObject({
      type: 'add',
      fields: {
        speciesId: GOUDHAANTJE_KEVER,
        activityId: 94,
        methodId: 473,
        uncertain: true,
        uncertainReason: 'Insect, opgezocht (gezegd: "goudhaantje")',
      },
    });
  });

  it('neemt de naam uit de twijfelreden als unlisted_species leeg is', () => {
    setInsectsEnabled(true);
    const { actions } = parseResponse(kever(), [], true);
    expect(actions[0]).toMatchObject({ fields: { speciesId: GOUDHAANTJE_KEVER } });
  });

  it('houdt de verzamelsoort als de naam niet te vinden is', () => {
    setInsectsEnabled(true);
    const { actions, warnings } = parseResponse(
      kever({ unlisted_species: 'qwertykever', uncertain_reason: 'Gezegd: qwertykever' }),
      [],
      true,
    );
    expect(actions[0]).toMatchObject({ fields: { speciesId: KEVER_ONBEKEND, uncertain: true } });
    expect(warnings).toEqual(['add_observation: "qwertykever" niet gevonden bij de insecten']);
  });

  it('zet een vogelcode om naar die van de groep', () => {
    setInsectsEnabled(true);
    const { actions } = parseResponse(
      toolResponse([
        'add_observation',
        {
          species_name: 'Hommel onbekend',
          species_id: HOMMEL_ONBEKEND,
          count: 2,
          activity_id: 2, // foeragerend bij vogels
          method_id: 48, // gezien bij vogels
        },
      ]),
      [],
      true,
    );
    expect(actions[0]).toMatchObject({ fields: { activityId: 3185, methodId: 498 } });
  });

  it('weigert insecten zonder de ontwikkeloptie', () => {
    const { rejected } = parseResponse(kever({ unlisted_species: 'goudhaantje' }), [], true);
    expect(rejected).toHaveLength(1);
  });

  it('zoekt een nachtvlinder met een vogelnaam bij de nachtvlinders', () => {
    setInsectsEnabled(true);
    const { actions } = parseResponse(
      toolResponse([
        'add_observation',
        {
          species_name: 'Nachtvlinder onbekend',
          species_id: NACHTVLINDER_ONBEKEND,
          unlisted_species: 'rietvink',
          count: 1,
          activity_id: 82,
          method_id: 273,
          uncertain: true,
        },
      ]),
      [],
      true,
    );
    expect(actions[0]).toMatchObject({ fields: { speciesId: RIETVINK_VLINDER } });
  });
});
