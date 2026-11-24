import { describe, expect, it } from 'vitest';
import { KEEP, VINK, observation, toolResponse } from '../test-helpers';
import { describeContext, parseResponse, userMessage } from './interpret';

// De Engelse kant van de poortwachter (ontwikkeloptie "English",
// docs/plan-engels.md, stap 3): het model antwoordt met Engelse namen, de app
// zet ze om naar dezelfde ID's van waarneming.nl.

const en = (...calls: [name: string, input: object][]) =>
  parseResponse(toolResponse(...calls), [], false, 'en');

const WOODCHAT_SHRIKE = 53;
const UNIDENTIFIED_BIRD = 18926;
const BLACK_THROATED_LOON = 305;

describe('parseResponse in het Engels', () => {
  it('zoekt de soort op de Engelse naam, ook die van eBird', () => {
    const { actions, warnings } = en(
      ['add_observation', { species_name: 'Brambling', species_id: VINK, count: 2 }],
      ['add_observation', { species_name: 'Arctic Loon', species_id: 1, count: 1 }],
    );
    // De naam wint van een ID dat er niet bij hoort, zoals in het Nederlands
    expect(actions.map((a) => a.type === 'add' && a.fields.speciesId)).toEqual([
      KEEP,
      BLACK_THROATED_LOON,
    ]);
    expect(warnings).toHaveLength(2);
  });

  it('kent geen Engelse namen als de uitspraak Nederlands is', () => {
    const { warnings } = parseResponse(
      toolResponse(['add_observation', { species_name: 'Brambling', species_id: KEEP, count: 1 }]),
      [],
    );
    expect(warnings[0]).toContain('staat niet in de lijst');
  });

  it('zet Engelse kandidaten om, met een Engelse reden', () => {
    const { actions, warnings } = en([
      'add_observation',
      {
        species_name: 'Common Chiffchaff or Willow Warbler',
        species_id: 595858,
        count: 1,
        uncertain: true,
        candidate_species: ['Willow Warbler', 'Common Chiffchaff'],
      },
    ]);
    expect(warnings).toEqual([]);
    expect(actions[0]).toMatchObject({
      fields: {
        candidates: [89, 186],
        uncertainReason: 'Willow Warbler or Common Chiffchaff?',
      },
    });
  });

  it('zoekt een dwaalgast op zijn Engelse naam, ook alleen uit de reden', () => {
    for (const input of [
      { unlisted_species: 'Woodchat Shrikes' },
      { uncertain_reason: 'Said: Woodchat Shrike (not in the list)' },
    ]) {
      const { actions } = en([
        'add_observation',
        {
          species_name: 'Unidentified bird',
          species_id: UNIDENTIFIED_BIRD,
          count: 1,
          uncertain: true,
          ...input,
        },
      ]);
      expect(actions[0]).toMatchObject({ fields: { speciesId: WOODCHAT_SHRIKE, uncertain: true } });
    }
  });

  it('haalt een vergeten afstand uit een Engelse omschrijving', () => {
    const { actions } = en([
      'add_observation',
      {
        species_id: VINK,
        count: 1,
        place_description: 'about 300 yards to the north-east',
        place_distance_m: null,
        place_direction: null,
      },
    ]);
    expect(actions[0]).toMatchObject({
      fields: { spokenPlace: { distanceM: 274, direction: 'NO' } },
    });
  });

  it('maakt een Engelse omschrijving als het model alleen afstand en richting gaf', () => {
    const { actions } = en([
      'add_observation',
      { species_id: VINK, count: 1, place_distance_m: 1500, place_direction: 'ZO' },
    ]);
    expect(actions[0]).toMatchObject({ fields: { spokenPlace: { text: '1.5 km SE' } } });
  });
});

describe('context en bericht in het Engels', () => {
  it('beschrijft de recente waarnemingen in het Engels', () => {
    const obs = observation({
      speciesId: KEEP,
      count: 3,
      activityId: 6,
      sex: 'male',
      uncertain: true,
      remarks: 'ringed',
      position: { lat: 52, lon: 5, accuracy: 5, fixedAt: 0 },
    });
    const text = describeContext([obs], { lat: 52.0045, lon: 5, accuracy: 5, fixedAt: 0 }, 'en');
    expect(text).toContain('3 × Brambling, flying over, male, uncertain, remark: "ringed"');
    expect(text).toContain('500 m away');
    expect(describeContext([], undefined, 'en')).toBe('(no observations yet)');
  });

  it('zegt in het Engels dat het een stuk uit een trektelling is', () => {
    expect(userMessage('(no observations yet)', 'six Woodpigeons', 'trektel', 'en')).toBe(
      'This is a chunk from a migration count.\n\nRecent observations in this session (#1 = most recent):\n(no observations yet)\n\nVoice note: "six Woodpigeons"',
    );
  });

  it('laat het Nederlands zoals het was', () => {
    expect(userMessage('(nog geen waarnemingen)', 'zes houtduiven', undefined)).toBe(
      'Recente waarnemingen in deze sessie (#1 = meest recent):\n(nog geen waarnemingen)\n\nUitspraak: "zes houtduiven"',
    );
  });
});
