import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';

// Delen met de ontwikkelaar: persoonsgegevens gaan niet mee (#18 in
// docs/plan-robuustheid.md; feedback 20 nov, een BSN in de feedback).

const sent = new Map<string, Blob>();
const putShared = vi.fn(async (path: string, body: Blob) => void sent.set(path, body));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  putShared: (path: string, body: Blob) => putShared(path, body),
  getTester: () => undefined,
}));

const { setShareAudio, setShareEnabled, shareNow } = await import('./share');

const BSN = '123456782';
const opname = () => ({ data: new Uint8Array([1, 2, 3]).buffer, type: 'audio/webm' });

beforeEach(async () => {
  localStorage.clear();
  sent.clear();
  putShared.mockClear();
  setShareEnabled(true);
  setShareAudio(true);
  await db.sessions.add({ id: 's1', startedAt: 100, endedAt: 200, status: 'ended' } as never);
  await db.utterances.bulkAdd([
    {
      id: 'u1',
      sessionId: 's1',
      recordedAt: 110,
      status: 'done',
      kind: 'dev_note',
      transcript: `Feedback, mijn BSN-nummer is ${BSN}.`,
      llmOutput: { content: [{ type: 'tool_use', input: { text: `mijn BSN is ${BSN}` } }] },
      audio: opname(),
    },
    {
      id: 'u2',
      sessionId: 's1',
      recordedAt: 120,
      status: 'done',
      transcript: 'Zes houtduiven.',
      audio: opname(),
    },
  ] as never);
  await db.observations.add({
    id: 'o1',
    sessionId: 's1',
    utteranceId: 'u2',
    speciesId: 1,
    count: 6,
    remarks: `bel 06 12345678`,
  } as never);
});

async function sentSession(id: string) {
  return JSON.parse(await sent.get(`sessions/${id}`)!.text());
}

describe('delen zonder persoonsgegevens', () => {
  it('laat cijferreeksen weg uit tekst, uitvoer van het model en waarnemingen', async () => {
    await shareNow();
    const body = JSON.stringify(await sentSession('s1'));
    expect(body).not.toContain(BSN);
    expect(body).not.toContain('12345678');
    const data = await sentSession('s1');
    expect(data.utterances[0].transcript).toBe('Feedback, mijn BSN-nummer is [weggelaten].');
    expect(data.utterances[1].transcript).toBe('Zes houtduiven.');
    expect(data.observations[0].remarks).toBe('bel [weggelaten]');
  });

  it('stuurt de opname van zo’n uitspraak niet mee, de andere wel', async () => {
    expect(await shareNow()).toEqual({ sessions: 1, audio: 1 });
    expect(sent.has('audio/u1')).toBe(false);
    expect(sent.has('audio/u2')).toBe(true);
  });

  it('laat op de telefoon alles staan', async () => {
    await shareNow();
    expect((await db.utterances.get('u1'))?.transcript).toContain(BSN);
  });

  it('probeert het na een mislukte ronde opnieuw, ook dan zonder persoonsgegevens', async () => {
    putShared.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(shareNow()).rejects.toThrow();
    expect(sent.size).toBe(0);
    await shareNow();
    expect(JSON.stringify(await sentSession('s1'))).not.toContain(BSN);
  });
});
