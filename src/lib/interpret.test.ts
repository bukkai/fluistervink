import { describe, expect, it } from 'vitest';
import {
  ATALANTA,
  BOOMKLEVER,
  BOOMKRUIPER,
  HOUTDUIF,
  KEEP,
  VINK,
  observation,
  REE,
  toolResponse,
} from '../test-helpers';
import {
  describeContext,
  MAX_OPTIONAL_PARAMETERS,
  parseResponse,
  promptVersionFor,
  toolsFor,
} from './interpret';

// parseResponse is de poortwachter tussen model en database: wat hier
// doorkomt, voert de app uit. Het model mag geen soorten verzinnen en niet
// verwijzen naar waarnemingen die het niet kreeg.

describe('parseResponse', () => {
  it('maakt van add_observation een actie, zonder velden die het model wegliet', () => {
    const { actions, rejected } = parseResponse(
      toolResponse([
        'add_observation',
        { species_name: 'Houtduif', species_id: HOUTDUIF, count: 6, activity_id: 1 },
      ]),
      [],
    );
    expect(rejected).toEqual([]);
    expect(actions).toEqual([
      { type: 'add', fields: { speciesId: HOUTDUIF, count: 6, activityId: 1 } },
    ]);
  });

  it('gebruikt de naam als het ID bij een andere soort hoort (Boomklever/Boomkruiper)', () => {
    const { actions, warnings } = parseResponse(
      toolResponse([
        'add_observation',
        { species_name: 'Boomkruiper', species_id: BOOMKLEVER, count: 1 },
      ]),
      [],
    );
    expect(actions[0]).toMatchObject({ type: 'add', fields: { speciesId: BOOMKRUIPER } });
    expect(warnings).toHaveLength(1);
  });

  it('accepteert een wetenschappelijke naam in species_name zonder waarschuwing', () => {
    const { actions, warnings } = parseResponse(
      toolResponse([
        'add_observation',
        { species_name: 'fringilla coelebs', species_id: VINK, count: 1 },
      ]),
      [],
    );
    expect(actions[0]).toMatchObject({ type: 'add', fields: { speciesId: VINK } });
    expect(warnings).toEqual([]);
  });

  it('zoekt een gezegde dwaalgast op en maakt hem onzeker', () => {
    const { actions, rejected, warnings } = parseResponse(
      toolResponse([
        'add_observation',
        {
          species_name: 'Vogel onbekend',
          species_id: 18926,
          unlisted_species: 'roodkopklauwier',
          count: 1,
          uncertain: true,
          uncertain_reason: 'Gezegd: roodkopklauwier (niet in de lijst)',
        },
      ]),
      [],
    );
    expect(rejected).toEqual([]);
    expect(warnings).toEqual([]);
    expect(actions[0]).toMatchObject({
      type: 'add',
      fields: {
        speciesId: 53,
        uncertain: true,
        uncertainReason: 'Dwaalgast, niet in de vaste lijst (gezegd: "roodkopklauwier")',
      },
    });
  });

  it('houdt de verzamelsoort als de dwaalgast niet te vinden is', () => {
    const { actions, warnings } = parseResponse(
      toolResponse([
        'add_observation',
        {
          species_name: 'Vogel onbekend',
          species_id: 18926,
          unlisted_species: 'albatros',
          count: 1,
          uncertain: true,
        },
      ]),
      [],
    );
    expect(actions[0]).toMatchObject({ type: 'add', fields: { speciesId: 18926 } });
    expect(warnings).toEqual(['add_observation: "albatros" niet gevonden bij de dwaalgasten']);
  });

  it('weigert een dwaalgast-ID dat het model zelf kiest', () => {
    const { rejected } = parseResponse(
      toolResponse(['add_observation', { species_id: 53, count: 1 }]),
      [],
    );
    expect(rejected).toHaveLength(1);
  });

  it('weigert een soort-ID dat niet in de lijst staat', () => {
    const { actions, rejected } = parseResponse(
      toolResponse(['add_observation', { species_id: 999999, count: 1 }]),
      [],
    );
    expect(actions).toEqual([]);
    expect(rejected[0]).toMatch(/onbekende soort-ID/);
  });

  it('weigert een aantal onder de 1 en een ongeldige code', () => {
    const { actions, rejected } = parseResponse(
      toolResponse(
        ['add_observation', { species_id: VINK, count: 0 }],
        ['add_observation', { species_id: VINK, count: 1, activity_id: 123456 }],
      ),
      [],
    );
    expect(actions).toEqual([]);
    expect(rejected).toHaveLength(2);
  });

  it('weigert een aantal dat geen heel getal is, en een onbekend geslacht', () => {
    const { actions, rejected } = parseResponse(
      toolResponse(
        ['add_observation', { species_id: VINK, count: 2.5 }],
        ['add_observation', { species_id: VINK, count: '3' }],
        ['add_observation', { species_id: VINK, count: 1, sex: 'beide' }],
        ['update_observation', { ref: 1, add_count: 'drie' }],
      ),
      [observation()],
    );
    expect(actions).toEqual([]);
    expect(rejected).toHaveLength(4);
  });

  it('weigert een toevoeging zonder aantal', () => {
    const { rejected } = parseResponse(toolResponse(['add_observation', { species_id: VINK }]), []);
    expect(rejected).toEqual(['add_observation: soort of aantal ontbreekt']);
  });

  it('zet een verwijzing (#1 = nieuwste in de context) om naar de juiste waarneming', () => {
    const newest = observation({ speciesId: VINK });
    const older = observation({ speciesId: HOUTDUIF });
    const { actions } = parseResponse(
      toolResponse(
        ['update_observation', { ref: 1, species_name: 'Keep', species_id: KEEP }],
        ['update_observation', { ref: 2, add_count: 3 }],
        ['delete_observation', { ref: 2 }],
      ),
      [newest, older],
    );
    expect(actions).toEqual([
      { type: 'update', observationId: newest.id, fields: { speciesId: KEEP } },
      { type: 'update', observationId: older.id, fields: {}, addCount: 3 },
      { type: 'delete', observationId: older.id },
    ]);
  });

  it('weigert een verwijzing naar een waarneming die niet in de context stond', () => {
    const { actions, rejected } = parseResponse(toolResponse(['delete_observation', { ref: 2 }]), [
      observation(),
    ]);
    expect(actions).toEqual([]);
    expect(rejected).toEqual(['delete_observation: verwijzing #2 bestaat niet']);
  });

  it('bewaart de twijfelreden alleen bij een onzekere waarneming', () => {
    const { actions } = parseResponse(
      toolResponse(
        [
          'add_observation',
          { species_id: VINK, count: 1, uncertain: true, uncertain_reason: 'kan ook keep zijn' },
        ],
        [
          'add_observation',
          { species_id: VINK, count: 1, uncertain: false, uncertain_reason: 'zomaar' },
        ],
      ),
      [],
    );
    expect(actions[0]).toMatchObject({
      fields: { uncertain: true, uncertainReason: 'kan ook keep zijn' },
    });
    expect(actions[1]).toEqual({
      type: 'add',
      fields: { speciesId: VINK, count: 1, uncertain: false },
    });
  });

  it('kent undo, redo en add_dev_note', () => {
    const { actions } = parseResponse(
      toolResponse(['undo', {}], ['redo', {}], ['add_dev_note', { text: 'x' }]),
      [],
    );
    expect(actions).toEqual([{ type: 'undo' }, { type: 'redo' }, { type: 'dev_note', text: 'x' }]);
  });
});

// De afstand in de context laat het model "nog een X" van een paar kilometer
// verderop als nieuwe waarneming zien (feedback 13 okt, Aalscholver op de A12).
describe('kandidaten', () => {
  const twijfel = (names: unknown[]) =>
    parseResponse(
      toolResponse([
        'add_observation',
        {
          species_name: 'Tjiftjaf of Fitis',
          species_id: 595858,
          count: 1,
          uncertain: true,
          candidate_species: names,
        },
      ]),
      [],
    );

  it("zet de namen om naar ID's en maakt de waarneming onzeker", () => {
    const { actions, warnings } = twijfel(['Fitis', 'tjiftjaf', 'Fitis']);
    expect(warnings).toEqual([]);
    expect(actions[0]).toMatchObject({
      type: 'add',
      fields: { candidates: [89, 186], uncertain: true, uncertainReason: 'Fitis of Tjiftjaf?' },
    });
  });

  it('negeert ze als er minder dan twee of meer dan drie geldig zijn', () => {
    for (const names of [
      ['Fitis', 'Bosfitis-achtige'],
      ['Fitis'],
      ['Fitis', 'Tjiftjaf', 'Vink', 'Keep'],
    ]) {
      const { actions, warnings } = twijfel(names);
      expect(actions[0]).not.toHaveProperty('fields.candidates');
      expect(warnings.length).toBeGreaterThan(0);
    }
  });

  it('staan in de context voor het model', () => {
    const obs = observation({ speciesId: 595858, uncertain: true, candidates: [89, 186] });
    expect(describeContext([obs])).toContain('twijfel tussen: Fitis, Tjiftjaf');
  });
});

describe('plek uit de uitspraak', () => {
  const add = (input: object) =>
    parseResponse(toolResponse(['add_observation', { species_id: VINK, count: 1, ...input }]), []);

  it('neemt omschrijving, afstand en windrichting over', () => {
    const { actions } = add({
      place_description: '500 m zuid van hier',
      place_distance_m: 500,
      place_direction: 'Z',
    });
    expect(actions[0]).toMatchObject({
      fields: { spokenPlace: { text: '500 m zuid van hier', distanceM: 500, direction: 'Z' } },
    });
  });

  it('alleen een omschrijving, of helemaal niets', () => {
    expect(
      add({ place_description: 'overkant rivier', place_distance_m: null, place_direction: null })
        .actions[0],
    ).toMatchObject({ fields: { spokenPlace: { text: 'overkant rivier' } } });
    expect(add({}).actions[0]).not.toHaveProperty('fields.spokenPlace');
  });

  it('laat een onmogelijke afstand of richting weg, met een waarschuwing', () => {
    const { actions, warnings } = add({
      place_description: 'ver weg',
      place_distance_m: 900_000,
      place_direction: 'links',
    });
    expect(actions[0]).toMatchObject({ fields: { spokenPlace: { text: 'ver weg' } } });
    expect(actions[0]).not.toHaveProperty('fields.spokenPlace.distanceM');
    expect(actions[0]).not.toHaveProperty('fields.spokenPlace.direction');
    expect(warnings).toHaveLength(2);
  });

  it('haalt een vergeten afstand uit de omschrijving', () => {
    const { actions } = add({
      place_description: '300 meter ten westen',
      place_distance_m: null,
      place_direction: 'W',
    });
    expect(actions[0]).toMatchObject({
      fields: { spokenPlace: { text: '300 meter ten westen', distanceM: 300, direction: 'W' } },
    });
  });

  it('zonder omschrijving maakt de app er een', () => {
    const { actions } = add({ place_distance_m: 200, place_direction: 'W' });
    expect(actions[0]).toMatchObject({ fields: { spokenPlace: { text: '200 m W' } } });
  });

  it('staat in de context voor het model', () => {
    const text = describeContext([observation({ spokenPlace: { text: 'overkant rivier' } })]);
    expect(text).toMatch(/plek: "overkant rivier"/);
  });
});

describe('describeContext', () => {
  const here = { lat: 52.0557, lon: 5.4, accuracy: 10, fixedAt: 0 };
  const at = (lat: number, lon: number) => ({ lat, lon, accuracy: 10, fixedAt: 0 });

  it('noemt de afstand alleen als een waarneming ver weg is', () => {
    const text = describeContext(
      [
        observation({ speciesId: HOUTDUIF, position: at(52.0558, 5.4) }),
        observation({ speciesId: VINK, position: at(52.0587, 5.4) }),
        observation({ speciesId: KEEP, position: at(52.051, 5.4583) }),
        observation({ speciesId: KEEP }),
      ],
      here,
    );
    const lines = text.split('\n');
    expect(lines[0]).not.toMatch(/hiervandaan/);
    expect(lines[1]).toMatch(/, 350 m hiervandaan$/);
    expect(lines[2]).toMatch(/, 4,0 km hiervandaan$/);
    // Zonder positie geen afstand
    expect(lines[3]).not.toMatch(/hiervandaan/);
  });

  it('noemt geen afstand als de uitspraak nog geen positie heeft', () => {
    const text = describeContext([observation({ position: at(52.051, 5.4583) })]);
    expect(text).not.toMatch(/hiervandaan/);
  });
});

// Anthropic weigert anders elke uitspraak met een 400 (feedback 12 nov: met
// de kandidaten aan waren het er 26). Een nagebootst model merkt dat niet.
describe('tools', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('blijven onder de grens van optionele velden (kandidaten: %s, soortgroepen: %s)', (k, g) => {
    let optional = 0;
    for (const tool of toolsFor(k, g)) {
      const schema = tool.input_schema as { properties?: object; required?: string[] };
      optional += Object.keys(schema.properties ?? {}).length - (schema.required?.length ?? 0);
    }
    expect(optional).toBeLessThanOrEqual(MAX_OPTIONAL_PARAMETERS);
  });
});

describe('andere soortgroepen', () => {
  it('accepteert ze alleen met de ontwikkeloptie', () => {
    const response = toolResponse([
      'add_observation',
      { species_name: 'Ree', species_id: REE, count: 2, activity_id: 16, method_id: 123 },
    ]);
    expect(parseResponse(response, []).rejected).toHaveLength(1);
    const { actions, rejected, warnings } = parseResponse(response, [], true);
    expect(rejected).toEqual([]);
    expect(warnings).toEqual([]);
    expect(actions).toEqual([
      { type: 'add', fields: { speciesId: REE, count: 2, activityId: 16, methodId: 123 } },
    ]);
  });

  it('zet een vogelcode bij een ree om naar die van zoogdieren', () => {
    // vogels: foeragerend 2, gezien 48, zingend 4 (bestaat niet bij zoogdieren)
    const { actions, warnings } = parseResponse(
      toolResponse([
        'add_observation',
        { species_name: 'Ree', species_id: REE, count: 1, activity_id: 2, method_id: 48 },
      ]),
      [],
      true,
    );
    expect(actions[0]).toMatchObject({ fields: { activityId: 16, methodId: 123 } });
    expect(warnings).toHaveLength(2);
  });

  it('controleert de codes bij een aanpassing tegen de soort van die waarneming', () => {
    const ree = observation({ speciesId: REE, activityId: 15 });
    const { actions } = parseResponse(
      toolResponse(['update_observation', { ref: 1, activity_id: 6 }]),
      [ree],
      true,
    );
    // vogels: overvliegend 6 → zoogdieren: overvliegend 72
    expect(actions[0]).toMatchObject({ type: 'update', fields: { activityId: 72 } });
  });

  it('kent een vlinder op naam', () => {
    const { actions } = parseResponse(
      toolResponse(['add_observation', { species_name: 'Atalanta', species_id: 1, count: 1 }]),
      [],
      true,
    );
    expect(actions[0]).toMatchObject({ fields: { speciesId: ATALANTA } });
  });

  it('laat de prompt zonder de optie ongemoeid: alleen vogelcodes in de tools', async () => {
    expect(await promptVersionFor(false, true)).not.toBe(await promptVersionFor(false));
    const activityEnum = (withGroups: boolean) => {
      const add = toolsFor(false, withGroups).find((t) => t.name === 'add_observation')!;
      const props = add.input_schema.properties as Record<string, { enum?: number[] }>;
      return props.activity_id.enum!;
    };
    // 15 = ter plaatse bij zoogdieren
    expect(activityEnum(false)).not.toContain(15);
    expect(activityEnum(true)).toContain(15);
  });

  it('beschrijft de context met de codes van de groep', () => {
    const text = describeContext([observation({ speciesId: REE, activityId: 16, methodId: 592 })]);
    expect(text).toContain('Ree, foeragerend, prenten');
  });
});
