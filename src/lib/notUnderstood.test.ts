import { beforeEach, describe, expect, it } from 'vitest';
import { db, type Utterance } from './db';
import {
  dismissUtterance,
  editObservation,
  forgetRescue,
  listUtterances,
  notUnderstood,
  rescueUtterance,
} from './observations';
import { findPromptSpecies } from './vocab';

// Niet begrepen uitspraken bij het nalopen (docs/ideeen.md, "Niets verloren
// laten gaan"): terugluisteren, er een waarneming van maken of wegzetten.

const POSITION = { lat: 52.1, lon: 5.1, accuracy: 8, fixedAt: 1000 };

function utterance(id: string, fields: Partial<Utterance>): Utterance {
  return {
    id,
    sessionId: 's',
    recordedAt: 1000,
    status: 'done',
    result: 'ignored',
    transcript: 'en dan nog een gekke vink',
    ...fields,
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('niet begrepen uitspraken', () => {
  it('alleen afgeronde, niet begrepen uitspraken met tekst die nog niet nagelopen zijn', () => {
    const list = [
      utterance('ja', {}),
      utterance('opgeslagen', { result: 'saved' }),
      utterance('bezig', { status: 'processing', result: undefined }),
      utterance('mislukt', { status: 'failed', result: undefined }),
      // Leeg trektelstuk: daar zei niemand iets
      utterance('leeg', { trektel: true, transcript: '  ' }),
      utterance('feedback', { kind: 'dev_note' }),
      utterance('weggezet', { handled: 'none' }),
      utterance('gered', { handled: 'observation' }),
    ];
    expect(notUnderstood(list).map((u) => u.id)).toEqual(['ja']);
  });

  it('een waarneming maken: Vogel onbekend, onzeker, op de tijd en plek van de uitspraak', async () => {
    await db.utterances.add(utterance('u', { position: POSITION }));
    const id = await rescueUtterance('u');

    const obs = await db.observations.get(id!);
    expect(obs).toMatchObject({
      sessionId: 's',
      utteranceId: 'u',
      speciesId: findPromptSpecies('Vogel onbekend')!.id,
      count: 1,
      uncertain: true,
      observedAt: 1000,
      position: POSITION,
      status: 'draft',
    });
    expect(obs!.uncertainReason).toContain('en dan nog een gekke vink');
    expect(notUnderstood(await listUtterances('s'))).toEqual([]);
  });

  it('annuleren haalt de waarneming weg en zet de uitspraak terug op de kaart', async () => {
    await db.utterances.add(utterance('u', {}));
    const id = await rescueUtterance('u');
    await forgetRescue(id!);

    expect(await db.observations.count()).toBe(0);
    expect(await db.deletedObservations.count()).toBe(0);
    expect(notUnderstood(await listUtterances('s')).map((u) => u.id)).toEqual(['u']);
  });

  it('na opslaan blijft hij, ook als het formulier daarna als annuleren sluit', async () => {
    await db.utterances.add(utterance('u', {}));
    const id = await rescueUtterance('u');
    await editObservation(id!, { speciesId: findPromptSpecies('Vink')!.id });
    await forgetRescue(id!);

    expect(await db.observations.get(id!)).toMatchObject({ status: 'reviewed' });
    expect(notUnderstood(await listUtterances('s'))).toEqual([]);
  });

  it('"Geen waarneming" zet hem weg zonder waarneming', async () => {
    await db.utterances.add(utterance('u', {}));
    await dismissUtterance('u');

    expect(await db.observations.count()).toBe(0);
    expect(notUnderstood(await listUtterances('s'))).toEqual([]);
  });
});
