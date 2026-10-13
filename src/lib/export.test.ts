import { describe, expect, it } from 'vitest';
import { observation } from '../test-helpers';
import { db } from './db';
import { importJson } from './export';

// Terugzetten van een JSON-export. Zo'n export kan van een tester komen
// (npm run feedback -- pull), dus de import vertrouwt de inhoud niet.

const position = { lat: 52.1, lon: 5.1, accuracy: 12, fixedAt: 1 };

function exportFile(fields: Record<string, unknown> = {}): File {
  const data = {
    sessions: [{ id: 'wandeling', startedAt: 1, endedAt: 2, status: 'ended' }],
    utterances: [
      { id: 'uitspraak', sessionId: 'wandeling', recordedAt: 1, position, status: 'done' },
      // Losse feedback, buiten een wandeling
      { id: 'los', sessionId: '', recordedAt: 1, kind: 'dev_note', status: 'done' },
    ],
    observations: [observation({ id: 'o1', position, area: { id: 7, name: 'Duinen' } })],
    deletedObservations: [],
    ...fields,
  };
  return new File([JSON.stringify(data)], 'export.json', { type: 'application/json' });
}

describe('importJson', () => {
  it('zet een geldige export terug', async () => {
    expect(await importJson(exportFile())).toEqual({ added: 1, skipped: 0 });
    expect(await db.observations.get('o1')).toMatchObject({ count: 1, position });
  });

  it.each([
    ['een aantal dat HTML is', { count: '<img src=x onerror=alert(1)>' }],
    ['een positie met tekst', { position: { ...position, lat: '1" onmouseover="x' } }],
    ['een gebied zonder naam', { area: { id: 7, name: 42 } }],
    ['een soort die geen getal is', { speciesId: 'vink' }],
  ])('weigert een waarneming met %s, en zet dan niets terug', async (_, fields) => {
    const file = exportFile({ observations: [{ ...observation({ id: 'o1' }), ...fields }] });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export');
    expect(await db.sessions.count()).toBe(0);
  });

  it('weigert een opname die geen audio is', async () => {
    const file = exportFile({
      utterances: [
        {
          id: 'uitspraak',
          sessionId: 'wandeling',
          recordedAt: 1,
          audioData: 'data:text/html;base64,PHNjcmlwdD4=',
        },
      ],
    });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export');
  });

  it('weigert een prullenbak met een ongeldige waarneming', async () => {
    const file = exportFile({ deletedObservations: [{ ...observation(), count: '3' }] });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export');
  });
});
