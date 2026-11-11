import { describe, expect, it } from 'vitest';
import type { Observation } from './db';
import { confirmationText } from './spoken';

const HOUTDUIF = 120;
const VINK = 193;

function obs(id: string, fields: Partial<Observation>): Observation {
  return {
    id,
    sessionId: 's',
    utteranceId: 'u',
    speciesId: HOUTDUIF,
    count: 1,
    observedAt: 0,
    createdAt: 0,
    uncertain: false,
    status: 'draft',
    ...fields,
  };
}

function current(...list: Observation[]) {
  return new Map(list.map((o) => [o.id, o]));
}

describe('gesproken bevestiging', () => {
  it('noemt soort, aantal en een afwijkende activiteit', () => {
    const text = confirmationText(
      { status: 'done', result: 'saved', changes: [{ type: 'add', observationId: 'a' }] },
      current(obs('a', { count: 6, activityId: 6 })),
    );
    expect(text).toBe('Houtduif, 6, overvliegend');
  });

  it('laat "ter plaatse" weg en leest geen schuine streep', () => {
    expect(
      confirmationText(
        { status: 'done', result: 'saved', changes: [{ type: 'add', observationId: 'a' }] },
        current(obs('a', { speciesId: VINK, activityId: 1 })),
      ),
    ).toBe('Vink, 1');
    expect(
      confirmationText(
        { status: 'done', result: 'saved', changes: [{ type: 'add', observationId: 'a' }] },
        current(obs('a', { speciesId: VINK, activityId: 4 })),
      ),
    ).toBe('Vink, 1, baltsend of zingend');
  });

  it('zegt erbij als het onzeker is', () => {
    const text = confirmationText(
      { status: 'done', result: 'uncertain', changes: [{ type: 'add', observationId: 'a' }] },
      current(obs('a', { count: 2, uncertain: true })),
    );
    expect(text).toBe('Houtduif, 2. Onzeker');
  });

  it('wijziging en verwijdering', () => {
    const text = confirmationText(
      {
        status: 'done',
        result: 'saved',
        changes: [
          { type: 'update', observationId: 'a', before: { count: 6 } },
          { type: 'delete', observation: obs('b', { speciesId: VINK }) },
        ],
      },
      current(obs('a', { count: 9 })),
    );
    expect(text).toBe('Aangepast: houtduif, 9. Weg: vink');
  });

  it('bij meer dan twee waarnemingen alleen het aantal', () => {
    const changes = ['a', 'b', 'c'].map((id) => ({ type: 'add' as const, observationId: id }));
    const text = confirmationText(
      { status: 'done', result: 'saved', changes },
      current(obs('a', {}), obs('b', {}), obs('c', {})),
    );
    expect(text).toBe('3 waarnemingen');
  });

  it('fout, niet begrepen, feedback en ongedaan maken', () => {
    expect(confirmationText({ status: 'failed' }, current())).toBe('Niet gelukt');
    expect(confirmationText({ status: 'done', result: 'ignored' }, current())).toBe(
      'Niet begrepen',
    );
    expect(confirmationText({ status: 'done', result: 'note' }, current())).toBe(
      'Feedback bewaard',
    );
    expect(
      confirmationText(
        { status: 'done', result: 'saved', undid: { utteranceId: 'x', changes: [] } },
        current(),
      ),
    ).toBe('Ongedaan gemaakt');
  });
});
