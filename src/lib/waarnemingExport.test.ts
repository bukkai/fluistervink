import { describe, expect, it } from 'vitest';
import { HOUTDUIF, VINK, observation } from '../test-helpers';
import { db, type Session } from './db';
import { buildExport } from './waarnemingExport';

// De CSV moet precies passen op de bulkimport van waarneming.nl (getest op
// 11 okt, zie docs/waarneming-nl.md). Deze tests leggen dat formaat vast.

const session: Session = {
  id: 'wandeling',
  startedAt: Date.parse('2026-10-11T14:00:00'),
  status: 'ended',
};
const position = { lat: 51.9789, lon: 5.8812346, accuracy: 7.6, fixedAt: 0 };

async function csvLines(): Promise<string[]> {
  const { csv } = await buildExport(session);
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

    const result = await buildExport(session);
    expect(result.exported.map((o) => o.id)).toEqual([withPosition.id]);
    expect(result.skipped.map((o) => o.id)).toEqual([withoutPosition.id]);
    expect(result.excluded.map((o) => o.id)).toEqual([unchecked.id]);
    expect(result.filename).toBe('waarneming-2026-10-11.csv');
  });

  it('zet een onbekende nauwkeurigheid (boven 1000 m) op 999', async () => {
    await db.observations.add(observation({ position: { ...position, accuracy: 2500 } }));
    expect((await csvLines())[1].split(',')[5]).toBe('999');
  });
});
