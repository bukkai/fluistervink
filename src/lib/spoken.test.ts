import { describe, expect, it } from 'vitest';
import type { Observation } from './db';
import { catchUpText, confirmationText } from './spoken';

const HOUTDUIF = 120;
const VINK = 193;
const SPREEUW = 180;

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
    expect(text).toBe('Houtduif, 2, onzeker');
  });

  it('zegt "onzeker" bij de waarneming die het is, niet aan het eind', () => {
    const text = confirmationText(
      {
        status: 'done',
        result: 'uncertain',
        changes: [
          { type: 'add', observationId: 'a' },
          { type: 'add', observationId: 'b' },
        ],
      },
      current(
        obs('a', { activityId: 6, uncertain: true }),
        obs('b', { speciesId: SPREEUW, count: 50, activityId: 6 }),
      ),
    );
    expect(text).toBe('Houtduif, 1, overvliegend, onzeker. Spreeuw, 50, overvliegend');
  });

  it('noemt de gezegde plek', () => {
    const say = (spokenPlace: Observation['spokenPlace']) =>
      confirmationText(
        { status: 'done', result: 'saved', changes: [{ type: 'add', observationId: 'a' }] },
        current(obs('a', { speciesId: SPREEUW, count: 50, spokenPlace })),
      );
    expect(
      say({ text: 'ongeveer dertig meter ten zuiden van hier', distanceM: 30, direction: 'Z' }),
    ).toBe('Spreeuw, 50, 30 meter zuid');
    expect(say({ text: '1500 m noordwest', distanceM: 1500, direction: 'NW' })).toBe(
      'Spreeuw, 50, 1,5 kilometer noordwest',
    );
    expect(say({ text: 'aan de overkant van de rivier' })).toBe(
      'Spreeuw, 50, aan de overkant van de rivier',
    );
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
    expect(text).toBe('Houtduif, 6 wordt 9. Weg: vink');
  });

  describe('bij een correctie wat het was en wat het werd', () => {
    const update = (before: Partial<Observation>, now: Partial<Observation>) =>
      confirmationText(
        {
          status: 'done',
          result: 'saved',
          changes: [{ type: 'update', observationId: 'a', before }],
        },
        current(obs('a', now)),
      );

    it('een andere soort: de oude soort en dan de nieuwe waarneming', () => {
      expect(update({ speciesId: VINK, uncertain: true }, { speciesId: SPREEUW, count: 3 })).toBe(
        'Vink wordt spreeuw, 3',
      );
    });

    it('dezelfde soort: alleen wat veranderde', () => {
      expect(
        update(
          { count: 2, spokenPlace: { text: 'dertig meter zuid', distanceM: 30, direction: 'Z' } },
          {
            count: 4,
            spokenPlace: { text: 'vijfhonderd meter noord', distanceM: 500, direction: 'N' },
          },
        ),
      ).toBe('Houtduif, 2, 30 meter zuid wordt 4, 500 meter noord');
    });

    it('niets om tegenover elkaar te zetten: aangepast, met hoe hij nu is', () => {
      expect(update({ uncertain: true }, { count: 5 })).toBe('Aangepast: houtduif, 5');
      expect(update({ activityId: undefined }, { count: 6, activityId: 6 })).toBe(
        'Aangepast: houtduif, 6, overvliegend',
      );
    });
  });

  it('bij meer dan twee waarnemingen alleen het aantal', () => {
    const changes = ['a', 'b', 'c'].map((id) => ({ type: 'add' as const, observationId: id }));
    const text = confirmationText(
      { status: 'done', result: 'saved', changes },
      current(obs('a', {}), obs('b', {}), obs('c', {})),
    );
    expect(text).toBe('3 waarnemingen');
  });

  it('bij meer dan twee waarnemingen hoeveel er onzeker zijn', () => {
    const changes = ['a', 'b', 'c', 'd'].map((id) => ({ type: 'add' as const, observationId: id }));
    const text = confirmationText(
      { status: 'done', result: 'uncertain', changes },
      current(obs('a', { uncertain: true }), obs('b', {}), obs('c', {}), obs('d', {})),
    );
    expect(text).toBe('4 waarnemingen, 1 onzeker');
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

describe('na het inhalen (lang op bereik gewacht)', () => {
  it('zegt alleen hoeveel er verwerkt is', () => {
    expect(catchUpText(6, 0)).toBe('6 uitspraken verwerkt');
    expect(catchUpText(1, 0)).toBe('Een uitspraak verwerkt');
    expect(catchUpText(5, 1)).toBe('5 uitspraken verwerkt, 1 niet gelukt');
    expect(catchUpText(0, 2)).toBe('2 niet gelukt');
  });
});
