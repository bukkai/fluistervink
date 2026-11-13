import { describe, expect, it, vi } from 'vitest';
import { HOUTDUIF, REE, VINK, observation, unzipStored } from '../test-helpers';
import { db, type Session } from './db';
import { HAND_ACCURACY, placeByHand } from './observations';
import {
  approveSession,
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
  id: 'sessie',
  startedAt: Date.parse('2026-10-11T14:00:00'),
  status: 'ended',
};
const position = { lat: 52.3601, lon: 4.9212346, accuracy: 7.6, fixedAt: 0 };

async function csvLines(): Promise<string[]> {
  const { file } = await buildExport([session]);
  return (await file.text()).split('\r\n');
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
      `2026-10-11,14:05,Fringilla coelebs,52.360100,4.921235,8,2,"zat op het hek, ""met ring""",M,False,,,gezien,exact aantal,${earlier.id}`,
    );
    expect(lines[2]).toMatch(/^2026-10-11,14:20,Columba palumbus,.*,6,,U,True,/);
    // Afsluitende CRLF
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('');
  });

  it('schrijft gedrag, methode en kleed van een ander dier in de codes van zijn groep', async () => {
    // zoogdieren: foeragerend 16, prenten 592, juveniel 27 (bij vogels andere ID's)
    await db.observations.add(
      observation({
        speciesId: REE,
        position,
        activityId: 16,
        methodId: 592,
        lifeStageId: 27,
        countingMethodId: 2,
      }),
    );
    const [, line] = await csvLines();
    expect(line).toMatch(/,Capreolus capreolus,.*,foeragerend,juveniel,prenten,exact aantal,/);
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

  it('neemt een met de hand gezette plek mee, niet de GPS-plek', async () => {
    const obs = observation({ position });
    await db.observations.add({
      ...obs,
      ...placeByHand(obs, obs.observedAt, 52.123456789, 5.1),
    });
    const [, lat, lng, accuracy] = (await csvLines())[1].split(',').slice(2, 6);
    expect([lat, lng, accuracy]).toEqual(['52.123457', '5.100000', String(HAND_ACCURACY)]);

    const xlsx = await buildExport([session], 'xlsx');
    const sheet = (await unzipStored(xlsx.file)).get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('<c r="D2" t="n"><v>52.123457</v></c>');
    expect(sheet).toContain('<c r="F2" t="n"><v>10</v></c>');
    expect(sheet).not.toContain('52.3601');
  });

  it('maakt in de app een xlsx met dezelfde kolommen, getallen als getal', async () => {
    await db.observations.add(
      observation({ observedAt: Date.parse('2026-10-11T14:10:00'), position }),
    );
    const result = await buildExport([session], 'xlsx');
    expect(result.filename).toBe('waarneming-2026-10-11-1400.xlsx');
    expect(result.file.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const sheet = (await unzipStored(result.file)).get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain(
      '<c r="A1" t="inlineStr"><is><t xml:space="preserve">date</t></is></c>',
    );
    expect(sheet).toContain(
      '<c r="O1" t="inlineStr"><is><t xml:space="preserve">uuid</t></is></c>',
    );
    expect(sheet).toContain(
      '<c r="A2" t="inlineStr"><is><t xml:space="preserve">2026-10-11</t></is></c>',
    );
    expect(sheet).toContain('<c r="D2" t="n"><v>52.3601</v></c>');
    expect(sheet).toContain('<c r="E2" t="n"><v>4.921235</v></c>');
    expect(sheet).toContain('<c r="F2" t="n"><v>8</v></c>');
  });
});

describe('meer sessies in één export', () => {
  const second: Session = {
    id: 'tweede',
    startedAt: Date.parse('2026-10-13T08:00:00'),
    status: 'ended',
  };

  it('zet de waarnemingen van alle sessies in één bestand, op volgorde van tijd', async () => {
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
    expect(result.filename).toBe('waarneming-2026-10-11-tot-2026-10-13-2-sessies.csv');
    expect((await result.file.text()).split('\r\n')).toHaveLength(4);
  });

  it('noemt een bestand met sessies van één dag naar die dag', async () => {
    const sameDay = { ...second, startedAt: Date.parse('2026-10-11T18:00:00') };
    const result = await buildExport([session, sameDay]);
    expect(result.filename).toBe('waarneming-2026-10-11-2-sessies.csv');
  });

  it('markeert na het exporteren alle sessies en waarnemingen', async () => {
    await db.sessions.bulkAdd([session, second]);
    const obs = observation({ sessionId: second.id, position });
    await db.observations.add(obs);

    await markExported([session, second], [obs]);
    const sessions = await db.sessions.bulkGet([session.id, second.id]);
    expect(sessions.every((s) => s?.exportedAt)).toBe(true);
    expect((await db.observations.get(obs.id))?.status).toBe('exported');
  });

  it('exporteert alleen klaargezette sessies die nog niet geëxporteerd zijn', async () => {
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

  it('"Alles klopt" zet de sessie klaar en de waarnemingen op nagelopen', async () => {
    await db.sessions.add(session);
    const draft = observation();
    const unsure = observation({ uncertain: true, uncertainReason: 'vink of keep?' });
    const exported = observation({ status: 'exported', uncertain: true });
    const elsewhere = observation({ sessionId: 'andere' });
    await db.observations.bulkAdd([draft, unsure, exported, elsewhere]);

    await approveSession(session.id);

    expect((await db.sessions.get(session.id))?.readyAt).toBeDefined();
    const [a, b, c, d] = await db.observations.bulkGet([
      draft.id,
      unsure.id,
      exported.id,
      elsewhere.id,
    ]);
    expect(a?.status).toBe('reviewed');
    expect(a?.editedAt).toBeUndefined();
    // Onzeker wordt zeker, zoals met "Klopt"
    expect(b).toMatchObject({ status: 'reviewed', uncertain: false });
    expect(b?.uncertainReason).toBeUndefined();
    expect(b?.editedAt).toBeDefined();
    expect(c).toMatchObject({ status: 'exported', uncertain: true });
    expect(d?.status).toBe('draft');
  });
});

describe('exportForWaarneming', () => {
  async function sessionWithObservation() {
    await db.sessions.add(session);
    const obs = observation({ position });
    await db.observations.add(obs);
    return obs;
  }

  it('markeert als geëxporteerd als het bestand is opgeslagen', async () => {
    const obs = await sessionWithObservation();
    saveFile.mockResolvedValueOnce({});
    expect(await exportForWaarneming([session])).toBe('1 waarneming geëxporteerd.');
    expect((await db.sessions.get(session.id))?.exportedAt).toBeDefined();
    expect((await db.observations.get(obs.id))?.status).toBe('exported');
  });

  it('zegt in de app in welke map het bestand staat', async () => {
    await sessionWithObservation();
    saveFile.mockResolvedValueOnce({ folder: 'Downloads' });
    expect(await exportForWaarneming([session])).toBe(
      '1 waarneming geëxporteerd. Het bestand staat in Downloads.',
    );
  });

  it('markeert niets als de gebruiker het opslaan annuleert', async () => {
    const obs = await sessionWithObservation();
    saveFile.mockResolvedValueOnce(false);
    expect(await exportForWaarneming([session])).toBeUndefined();
    expect((await db.sessions.get(session.id))?.exportedAt).toBeUndefined();
    expect((await db.observations.get(obs.id))?.status).not.toBe('exported');
  });

  it('meldt het en markeert niets als het opslaan mislukt', async () => {
    await sessionWithObservation();
    saveFile.mockRejectedValueOnce(new Error('geen ruimte'));
    expect(await exportForWaarneming([session])).toBe('Opslaan mislukt: geen ruimte');
    expect((await db.sessions.get(session.id))?.exportedAt).toBeUndefined();
  });
});
