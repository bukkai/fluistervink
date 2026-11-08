import { afterEach, describe, expect, it } from 'vitest';
import { db, type Utterance } from './db';
import {
  confirmDeleteText,
  countRecordings,
  deleteRecordings,
  describeRecordings,
} from './recordings';

// Alleen de opnames wissen; uitspraken, transcripten en waarnemingen blijven.

const opname = () => ({ data: new TextEncoder().encode('opus').buffer, type: 'audio/webm' });

function utterance(id: string, fields: Partial<Utterance> = {}): Utterance {
  return {
    id,
    sessionId: 'sessie',
    recordedAt: 1,
    status: 'done',
    transcript: 'vink',
    audio: opname(),
    ...fields,
  };
}

afterEach(() => localStorage.clear());

describe('deleteRecordings', () => {
  it('wist de opnames en laat de rest staan', async () => {
    await db.utterances.bulkAdd([utterance('a'), utterance('b', { status: 'failed' })]);
    await db.observations.add({
      id: 'w',
      sessionId: 'sessie',
      utteranceId: 'a',
      speciesId: 1,
      count: 1,
      observedAt: 1,
    } as never);

    expect(await deleteRecordings('sessie', 42)).toBe(2);

    const a = await db.utterances.get('a');
    expect(a?.audio).toBeUndefined();
    expect(a).toMatchObject({ transcript: 'vink', status: 'done', audioDeletedAt: 42 });
    expect(await db.observations.count()).toBe(1);
  });

  it('laat de wachtrij en mislukte uitspraken zonder transcript met rust', async () => {
    await db.utterances.bulkAdd([
      utterance('wacht', { status: 'pending', transcript: undefined }),
      utterance('bezig', { status: 'processing' }),
      utterance('mislukt', { status: 'failed', transcript: undefined }),
    ]);
    expect(await deleteRecordings('sessie')).toBe(0);
    for (const u of await db.utterances.toArray()) expect(u.audio).toBeDefined();
  });

  it('alleen de gekozen sessie, of zonder sessie alles', async () => {
    await db.utterances.bulkAdd([utterance('a'), utterance('b', { sessionId: 'andere' })]);
    expect(await deleteRecordings('sessie')).toBe(1);
    expect((await db.utterances.get('b'))?.audio).toBeDefined();
    expect(await deleteRecordings()).toBe(1);
    expect((await db.utterances.get('b'))?.audio).toBeUndefined();
  });

  it('getypte uitspraken (zonder opname) blijven zoals ze waren', async () => {
    await db.utterances.add(utterance('getypt', { audio: undefined }));
    expect(await deleteRecordings()).toBe(0);
    expect((await db.utterances.get('getypt'))?.audioDeletedAt).toBeUndefined();
  });
});

describe('countRecordings', () => {
  it('telt opnames, grootte en wat al gedeeld is', async () => {
    await db.utterances.bulkAdd([
      utterance('a'),
      utterance('b'),
      utterance('wacht', { status: 'pending' }),
    ]);
    localStorage.setItem('fluistervink.shared', JSON.stringify({ sessions: {}, audio: ['a'] }));
    expect(await countRecordings('sessie')).toEqual({ count: 2, bytes: 8, shared: 1 });
  });
});

describe('describeRecordings', () => {
  it('in kB of MB', () => {
    expect(describeRecordings({ count: 1, bytes: 300, shared: 0 })).toBe('1 opname (1 kB)');
    expect(describeRecordings({ count: 12, bytes: 1_250_000, shared: 0 })).toBe(
      '12 opnames (1,3 MB)',
    );
  });
});

describe('confirmDeleteText', () => {
  it('zegt eerlijk wat al gedeeld is', () => {
    expect(confirmDeleteText({ count: 3, bytes: 3000, shared: 0 }, 'van deze sessie')).not.toMatch(
      /gedeeld/,
    );
    expect(confirmDeleteText({ count: 3, bytes: 3000, shared: 1 }, 'x')).toMatch(
      /1 ervan is al gedeeld/,
    );
  });
});
