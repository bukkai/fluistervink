import { describe, expect, it, vi } from 'vitest';
import { HOUTDUIF, VINK, observation } from '../test-helpers';
import { db, type Session } from './db';
import {
  buildExport,
  exportForWaarneming,
  markExported,
  markReady,
  readyForExport,
} from './waarnemingExport';

// Het opslaan zelf (download of het venster van Android) nagebootst
const saveFile = vi.hoisted(() => vi.fn());
vi.mock('./export', async (actual) => ({
  ...(await actual<typeof import('./export')>()),
  saveFile,
}));

// De CSV moet precies passen op de bulkimport van waarneming.nl (getest op
// 11 okt, zie docs/waarneming-nl.md). Deze tests leggen dat formaat vast.

const session: Session = {
  id: 'wandeling',
  startedAt: Date.parse('2026-10-11T14:00:00'),
  status: 'ended',
};
const position = { lat: 51.9789, lon: 5.8812346, accuracy: 7.6, fixedAt: 0 };

async function csvLines(): Promise<string[]> {
  const { csv } = await buildExport([session]);
  return (await csv.text()).split('\r\n');
}

describe('buildExport', () => {
  it('schrijft een kopregel en een regel per waarneming, op volgorde van tijd', async () => {
    const later = observation({
      speciesId: HOUTDUIF,
      count: 6,
      observedAt: Date.parse('2026-10-11T14:20:00'),
      position,
      activityId: 1,
    });
    const earlier = observation({
      speciesId: VINK,
      count: 2,
      observedAt: Date.parse('2026-10-11T14:05:00'),
      position,
      sex: 'male',
      uncertain: true,
      remarks: 'zat op het hek, "met ring"',
      privateNote: 'niet exporteren',
      methodId: 48,
      countingMethodId: 2,
    });
    await db.observations.bulkAdd([later, earlier]);

    const lines = await csvLines();
    expect(lines[0]).toBe(
      'date,time,scientific name,lat,lng,accuracy,number,notes,sex,is certain,activity,life stage,method,counting method,uuid',
    );
    expect(lines[1]).toBe(
      `2026-10-11,14:05,Fringilla coelebs,51.978900,5.881235,8,2,"zat op het hek, ""met ring""",M,False,,,seen,real count,${earlier.id}`,
    );
    expect(lines[2]).toMatch(/^2026-10-11,14:20,Columba palumbus,.*,6,,U,True,/);
    // Afsluitende CRLF
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('');
  });

  it('laat waarnemingen zonder positie en uitgevinkte waarnemingen eruit', async () => {
    const withPosition = observation({ position });
    const withoutPosition = observation();
    const unchecked = observation({ position, skipExport: true });
    await db.observations.bulkAdd([withPosition, withoutPosition, unchecked]);

    const result = await buildExport([session]);
    expect(result.exported.map((o) => o.id)).toEqual([withPosition.id]);
    expect(result.skipped.map((o) => o.id)).toEqual([withoutPosition.id]);
    expect(result.excluded.map((o) => o.id)).toEqual([unchecked.id]);
    expect(result.filename).toBe('waarneming-2026-10-11-1400.csv');
  });

  it('zet een onbekende nauwkeurigheid (boven 1000 m) op 999', async () => {
    await db.observations.add(observation({ position: { ...position, accuracy: 2500 } }));
    expect((await csvLines())[1].split(',')[5]).toBe('999');
  });
});

describe('meer wandelingen in één export', () => {
  const second: Session = {
    id: 'tweede',
    startedAt: Date.parse('2026-10-13T08:00:00'),
    status: 'ended',
  };

  it('zet de waarnemingen van alle wandelingen in één bestand, op volgorde van tijd', async () => {
    const late = observation({
      sessionId: second.id,
      observedAt: Date.parse('2026-10-13T08:10:00'),
      position,
    });
    const early = observation({ observedAt: Date.parse('2026-10-11T14:10:00'), position });
    const elsewhere = observation({ sessionId: 'andere', position });
    await db.observations.bulkAdd([late, early, elsewhere]);

    const result = await buildExport([second, session]);
    expect(result.exported.map((o) => o.id)).toEqual([early.id, late.id]);
    expect(result.sessions.map((s) => s.id)).toEqual([session.id, second.id]);
    expect(result.filename).toBe('waarneming-2026-10-11-tot-2026-10-13-2-wandelingen.csv');
    expect((await result.csv.text()).split('\r\n')).toHaveLength(4);
  });

  it('noemt een bestand met wandelingen van één dag naar die dag', async () => {
    const sameDay = { ...second, startedAt: Date.parse('2026-10-11T18:00:00') };
    const result = await buildExport([session, sameDay]);
    expect(result.filename).toBe('waarneming-2026-10-11-2-wandelingen.csv');
  });

  it('markeert na het exporteren alle wandelingen en waarnemingen', async () => {
    await db.sessions.bulkAdd([session, second]);
    const obs = observation({ sessionId: second.id, position });
    await db.observations.add(obs);

    await markExported([session, second], [obs]);
    const sessions = await db.sessions.bulkGet([session.id, second.id]);
    expect(sessions.every((s) => s?.exportedAt)).toBe(true);
    expect((await db.observations.get(obs.id))?.status).toBe('exported');
  });

  it('exporteert alleen klaargezette wandelingen die nog niet geëxporteerd zijn', async () => {
    await db.sessions.bulkAdd([
      session,
      second,
      { ...session, id: 'al-weg', readyAt: 1, exportedAt: 2 },
      { ...session, id: 'nog-niet' },
    ]);
    await markReady(session.id, true);
    await markReady(second.id, true);
    await markReady(second.id, false);

    const ready = readyForExport(await db.sessions.toArray());
    expect(ready.map((s) => s.id)).toEqual([session.id]);
  });
});

describe('exportForWaarneming', () => {
  async function walkWithObservation() {
    await db.sessions.add(session);
    const obs = observation({ position });
    await db.observations.add(obs);
    return obs;
  }

  it('markeert als geëxporteerd als het bestand is opgeslagen', async () => {
    const obs = await walkWithObservation();
    saveFile.mockResolvedValueOnce(true);
    expect(await exportForWaarneming([session])).toBe('1 waarneming geëxporteerd.');
    expect((await db.sessions.get(session.id))?.exportedAt).toBeDefined();
    expect((await db.observations.get(obs.id))?.status).toBe('exported');
  });

  it('markeert niets als de gebruiker het opslaan annuleert', async () => {
    const obs = await walkWithObservation();
    saveFile.mockResolvedValueOnce(false);
    expect(await exportForWaarneming([session])).toBeUndefined();
    expect((await db.sessions.get(session.id))?.exportedAt).toBeUndefined();
    expect((await db.observations.get(obs.id))?.status).not.toBe('exported');
  });

  it('meldt het en markeert niets als het opslaan mislukt', async () => {
    await walkWithObservation();
    saveFile.mockRejectedValueOnce(new Error('geen ruimte'));
    expect(await exportForWaarneming([session])).toBe('Opslaan mislukt: geen ruimte');
    expect((await db.sessions.get(session.id))?.exportedAt).toBeUndefined();
  });
});
