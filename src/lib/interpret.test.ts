import { describe, expect, it } from 'vitest';
import { BOOMKLEVER, BOOMKRUIPER, HOUTDUIF, KEEP, VINK, observation, toolResponse } from '../test-helpers';
import { parseResponse } from './interpret';

// parseResponse is de poortwachter tussen model en database: wat hier
// doorkomt, voert de app uit. Het model mag geen soorten verzinnen en niet
// verwijzen naar waarnemingen die het niet kreeg.

describe('parseResponse', () => {
  it('maakt van add_observation een actie, zonder velden die het model wegliet', () => {
    const { actions, rejected } = parseResponse(
      toolResponse(['add_observation', { species_name: 'Houtduif', species_id: HOUTDUIF, count: 6, activity_id: 1 }]),
      [],
    );
    expect(rejected).toEqual([]);
    expect(actions).toEqual([{ type: 'add', fields: { speciesId: HOUTDUIF, count: 6, activityId: 1 } }]);
  });

  it('gebruikt de naam als het ID bij een andere soort hoort (Boomklever/Boomkruiper)', () => {
    const { actions, warnings } = parseResponse(
      toolResponse(['add_observation', { species_name: 'Boomkruiper', species_id: BOOMKLEVER, count: 1 }]),
      [],
    );
    expect(actions[0]).toMatchObject({ type: 'add', fields: { speciesId: BOOMKRUIPER } });
    expect(warnings).toHaveLength(1);
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
    const { actions, rejected } = parseResponse(
      toolResponse(['delete_observation', { ref: 2 }]),
      [observation()],
    );
    expect(actions).toEqual([]);
    expect(rejected).toEqual(['delete_observation: verwijzing #2 bestaat niet']);
  });

  it('bewaart de twijfelreden alleen bij een onzekere waarneming', () => {
    const { actions } = parseResponse(
      toolResponse(
        ['add_observation', { species_id: VINK, count: 1, uncertain: true, uncertain_reason: 'kan ook keep zijn' }],
        ['add_observation', { species_id: VINK, count: 1, uncertain: false, uncertain_reason: 'zomaar' }],
      ),
      [],
    );
    expect(actions[0]).toMatchObject({ fields: { uncertain: true, uncertainReason: 'kan ook keep zijn' } });
    expect(actions[1]).toEqual({ type: 'add', fields: { speciesId: VINK, count: 1, uncertain: false } });
  });

  it('kent undo en add_dev_note', () => {
    const { actions } = parseResponse(toolResponse(['undo', {}], ['add_dev_note', { text: 'x' }]), []);
    expect(actions).toEqual([{ type: 'undo' }, { type: 'dev_note' }]);
  });
});
