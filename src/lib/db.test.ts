import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { db } from './db';

// Nieuwe webcode komt binnen zonder nieuwe app (server.url): een sessie met
// wachtende uitspraken kan midden in een versiesprong van de database zitten.
// Wat er stond, moet er na het upgraden nog zijn en verwerkt kunnen worden.

describe('database upgraden', () => {
  it('versie 2 → nu: wachtende uitspraken en waarnemingen blijven staan', async () => {
    db.close();
    await Dexie.delete('fluistervink');
    const old = new Dexie('fluistervink');
    old.version(1).stores({
      sessions: 'id, status, startedAt',
      utterances: 'id, sessionId, status, recordedAt',
      observations: 'id, sessionId, utteranceId, observedAt',
    });
    old.version(2).stores({ events: '++id, at, type' });
    await old.open();
    await old.table('sessions').add({ id: 's', startedAt: 1, status: 'active' });
    await old.table('utterances').add({
      id: 'u',
      sessionId: 's',
      recordedAt: 2,
      status: 'pending',
      transcript: 'roepje vink',
    });
    await old
      .table('observations')
      .add({ id: 'o', sessionId: 's', utteranceId: 'x', observedAt: 1 });
    old.close();

    await db.open();
    expect(db.verno).toBeGreaterThan(2);
    const pending = await db.utterances.where('status').equals('pending').toArray();
    expect(pending.map((u) => u.id)).toEqual(['u']);
    expect(await db.sessions.get('s')).toMatchObject({ status: 'active' });
    expect(await db.observations.count()).toBe(1);
    // De tabel van de nieuwe versie bestaat en werkt
    expect(await db.deletedObservations.count()).toBe(0);
  });
});
