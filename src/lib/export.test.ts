import { describe, expect, it } from 'vitest';
import { observation } from '../test-helpers';
import { db } from './db';
import { describeImport, importJson } from './export';

// Terugzetten van een JSON-export. Zo'n export kan van een tester komen
// (npm run feedback -- pull), dus de import vertrouwt de inhoud niet.

const position = { lat: 52.1, lon: 5.1, accuracy: 12, fixedAt: 1 };

function exportFile(fields: Record<string, unknown> = {}): File {
  const data = {
    sessions: [{ id: 'sessie', startedAt: 1, endedAt: 2, status: 'ended' }],
    utterances: [
      { id: 'uitspraak', sessionId: 'sessie', recordedAt: 1, position, status: 'done' },
      // Losse feedback, buiten een sessie
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
    expect(await importJson(exportFile())).toEqual({ added: 1, skipped: 0, feedback: 1 });
    expect(await db.observations.get('o1')).toMatchObject({ count: 1, position });
    expect(await db.utterances.get('los')).toMatchObject({ kind: 'dev_note', sessionId: '' });
  });

  it('overschrijft niets bij een tweede keer terugzetten', async () => {
    await importJson(exportFile());
    await db.observations.update('o1', { count: 5 });
    await db.utterances.update('los', { transcript: 'eigen tekst' });
    expect(await importJson(exportFile())).toEqual({ added: 0, skipped: 1, feedback: 0 });
    expect(await db.observations.get('o1')).toMatchObject({ count: 5 });
    expect(await db.utterances.get('los')).toMatchObject({ transcript: 'eigen tekst' });
  });

  it('een back-up van een nieuwere versie: onbekende velden gaan gewoon mee', async () => {
    const file = exportFile({
      sessions: [{ id: 'sessie', startedAt: 1, endedAt: 2, status: 'ended', later: { x: 1 } }],
      observations: [observation({ id: 'o1', position, ...{ nieuwVeld: 'ja' } })],
    });
    expect(await importJson(file)).toMatchObject({ added: 1 });
    expect(await db.observations.get('o1')).toMatchObject({ nieuwVeld: 'ja' });
  });

  it('gaat er halverwege iets mis, dan komt er niets binnen', async () => {
    // Een waarneming met hetzelfde id staat er al, bij een andere sessie
    await db.observations.add(observation({ id: 'o1', sessionId: 'andere' }));
    await expect(importJson(exportFile())).rejects.toThrow();
    expect(await db.sessions.count()).toBe(0);
    expect(await db.utterances.count()).toBe(0);
    expect(await db.observations.get('o1')).toMatchObject({ sessionId: 'andere' });
  });

  it('terugzetten tijdens een lopende sessie: die blijft lopen en wordt niet overschreven', async () => {
    await db.sessions.add({ id: 'sessie', startedAt: 5, status: 'active' });
    const file = exportFile({
      sessions: [
        { id: 'sessie', startedAt: 1, endedAt: 2, status: 'ended' },
        { id: 'oud', startedAt: 1, status: 'active' },
      ],
    });
    expect(await importJson(file)).toMatchObject({ added: 1, skipped: 1 });
    expect(await db.sessions.get('sessie')).toMatchObject({ startedAt: 5, status: 'active' });
    // Liep bij het maken van de back-up nog: komt binnen als gestopt
    expect((await db.sessions.get('oud'))?.status).toBe('ended');
  });

  it('beschrijft de uitkomst in een zin', () => {
    expect(describeImport({ added: 2, skipped: 1, feedback: 1 })).toBe(
      '2 sessies teruggezet, te vinden bij Vorige sessies. 1 stond er al. 1× losse feedback teruggezet.',
    );
    expect(describeImport({ added: 0, skipped: 0, feedback: 0 })).toBe(
      'Geen nieuwe sessies gevonden.',
    );
  });

  it.each([
    ['een aantal dat HTML is', { count: '<img src=x onerror=alert(1)>' }],
    ['een positie met tekst', { position: { ...position, lat: '1" onmouseover="x' } }],
    ['een bewaarde GPS-plek met tekst', { recordedPosition: { ...position, lon: 'x' } }],
    ['een gebied zonder naam', { area: { id: 7, name: 42 } }],
    ['een gezegde plek met een rare richting', { spokenPlace: { text: 'daar', direction: 'X' } }],
    [
      'een gezegde plek met een geërfde sleutel als richting',
      { spokenPlace: { text: 'daar', direction: 'toString' } },
    ],
    ['een gezegde plek zonder tekst', { spokenPlace: { distanceM: 500 } }],
    ['een soort die geen getal is', { speciesId: 'vink' }],
    ['kandidaten met tekst', { candidates: [89, '<b>'] }],
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
          sessionId: 'sessie',
          recordedAt: 1,
          audioData: 'data:text/html;base64,PHNjcmlwdD4=',
        },
      ],
    });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export');
  });

  it('neemt het land van een uitspraak mee, maar weigert een onbekend land', async () => {
    const utterance = { id: 'uitspraak', sessionId: 'sessie', recordedAt: 1, status: 'done' };
    await importJson(exportFile({ utterances: [{ ...utterance, region: 'es' }] }));
    expect((await db.utterances.get('uitspraak'))?.region).toBe('es');
    const file = exportFile({ utterances: [{ ...utterance, id: 'ander', region: 'xx' }] });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export');
  });

  it('neemt een nagelopen niet begrepen uitspraak mee, maar weigert een onbekende waarde', async () => {
    const utterance = { id: 'uitspraak', sessionId: 'sessie', recordedAt: 1, status: 'done' };
    await importJson(exportFile({ utterances: [{ ...utterance, handled: 'none' }] }));
    expect((await db.utterances.get('uitspraak'))?.handled).toBe('none');
    const file = exportFile({ utterances: [{ ...utterance, id: 'ander', handled: 123 }] });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export');
  });

  it('weigert een sessie met een ongeldige inspanning', async () => {
    const session = { id: 'sessie', startedAt: 1, endedAt: 2, status: 'ended' };
    const file = exportFile({
      sessions: [{ ...session, effort: { activeMs: 1, distanceM: '5' } }],
    });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export');
  });

  it('weigert een sessie met een ongeldige checklist', async () => {
    const session = { id: 'sessie', startedAt: 1, endedAt: 2, status: 'ended' };
    for (const checklist of [
      { protocol: 'Traveling,Y' },
      { observers: 0 },
      { complete: 'ja' },
      { skipEbird: 1 },
    ]) {
      const file = exportFile({ sessions: [{ ...session, checklist }] });
      await expect(importJson(file)).rejects.toThrow('Ongeldige export');
    }
  });

  it('weigert een prullenbak met een ongeldige waarneming', async () => {
    const file = exportFile({ deletedObservations: [{ ...observation(), count: '3' }] });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export');
  });
});

describe('importJson en het log', () => {
  const events = [
    { id: 7, at: 0, type: 'voor de sessie' },
    { id: 8, at: 1, type: 'app_start', instance: 'a' },
    { id: 9, at: 2, type: 'gps_fix', instance: 'a', data: { accuracy: 8 } },
    { id: 10, at: 3, type: 'na de sessie' },
  ];

  it('zet het log binnen de tijd van een toegevoegde sessie terug, met een eigen nummer', async () => {
    await db.events.add({ at: 50, type: 'eigen' });
    await importJson(exportFile({ events }));
    const restored = await db.events.where('at').between(1, 2, true, true).toArray();
    expect(restored.map((e) => e.type)).toEqual(['app_start', 'gps_fix']);
    expect(restored[1].data).toEqual({ accuracy: 8 });
    expect(await db.events.where('type').anyOf('voor de sessie', 'na de sessie').count()).toBe(0);
  });

  it('zet het log niet dubbel terug, en niet bij een sessie die er al was', async () => {
    await db.events.add({ at: 1, type: 'app_start', instance: 'a' });
    await importJson(exportFile({ events }));
    await importJson(exportFile({ events: [...events, { at: 2, type: 'later', instance: 'b' }] }));
    const restored = await db.events.where('at').between(1, 2, true, true).toArray();
    expect(restored.map((e) => e.type)).toEqual(['app_start', 'gps_fix']);
  });

  it('weigert een log met een rare soort', async () => {
    const file = exportFile({ events: [{ at: 1, type: { html: '<b>' } }] });
    await expect(importJson(file)).rejects.toThrow('Ongeldige export: log');
    expect(await db.sessions.count()).toBe(0);
  });
});
