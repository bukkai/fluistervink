import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HOUTDUIF, VINK, observation } from '../test-helpers';
import { db, type Session, type Utterance } from './db';
import {
  COLUMNS,
  buildEbirdExport,
  clean,
  exportForEbird,
  lastObservers,
  pendingForEbird,
  resolveChecklist,
  setChecklist,
} from './ebirdExport';

// Het opslaan zelf (download of het venster van Android) nagebootst
const saveFile = vi.hoisted(() => vi.fn());
vi.mock('./export', async (actual) => ({
  ...(await actual<typeof import('./export')>()),
  saveFile,
}));

// Het eBird Record Format: 19 kolommen zonder kopregel, in deze volgorde
// (bijlage A van de importhandleiding van eBird, en het voorbeeldbestand).

const session: Session = {
  id: 'sessie',
  startedAt: Date.parse('2026-11-12T08:05:00'),
  endedAt: Date.parse('2026-11-12T09:40:00'),
  status: 'ended',
  place: { name: 'Amsterdamse Waterleidingduinen', source: 'walk' },
  effort: { activeMs: 90 * 60_000, distanceM: 4023.36 },
  checklist: { complete: true },
};
const position = { lat: 52.3601, lon: 4.9212346, accuracy: 7.6, fixedAt: 0 };

async function lines(sessions = [session]): Promise<string[][]> {
  const { file } = await buildEbirdExport(sessions);
  return (await file.text())
    .split('\r\n')
    .filter(Boolean)
    .map((line) => line.split(','));
}

function column(line: string[], name: (typeof COLUMNS)[number]): string {
  return line[COLUMNS.indexOf(name)];
}

beforeEach(async () => {
  await db.sessions.put(session);
  localStorage.clear();
});

describe('COLUMNS', () => {
  it('volgt het sjabloon van eBird', () => {
    expect(COLUMNS).toHaveLength(19);
    expect(COLUMNS.indexOf('Number')).toBe(3);
    expect(COLUMNS.indexOf('Date')).toBe(8);
    expect(COLUMNS.indexOf('Protocol')).toBe(12);
    expect(COLUMNS.indexOf('Effort Distance Miles')).toBe(16);
  });
});

describe('buildEbirdExport', () => {
  it('schrijft één regel per soort, zonder kopregel, met de inspanning van de sessie', async () => {
    await db.observations.bulkAdd([
      observation({ speciesId: VINK, count: 2, position, observedAt: session.startedAt + 1000 }),
      observation({
        speciesId: HOUTDUIF,
        count: 6,
        activityId: 1,
        observedAt: session.startedAt + 2000,
      }),
      observation({
        speciesId: VINK,
        count: 3,
        methodId: 49,
        observedAt: session.startedAt + 3000,
      }),
    ]);

    const result = await lines();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      '',
      'Fringilla',
      'coelebs',
      '5',
      '2; 3 gehoord',
      'Amsterdamse Waterleidingduinen',
      '52.360100',
      '4.921235',
      '11/12/2026',
      '08:05',
      '',
      'NL',
      'Traveling',
      '1',
      '90',
      'Y',
      '2.50',
      '',
      'Ingesproken met Fluistervink',
    ]);
    expect(column(result[1], 'Genus')).toBe('Columba');
    expect(column(result[1], 'Number')).toBe('6');
    expect(column(result[1], 'Species Comments')).toBe('6 ter plaatse');
  });

  it('Stationary zonder afstand, Incidental zonder duur', async () => {
    await db.observations.add(observation({ position }));
    await db.sessions.update(session.id, { effort: { activeMs: 20 * 60_000, distanceM: 30 } });
    let [line] = await lines([(await db.sessions.get(session.id))!]);
    expect(column(line, 'Protocol')).toBe('Stationary');
    expect(column(line, 'Duration')).toBe('20');
    expect(column(line, 'Effort Distance Miles')).toBe('');

    await setChecklist(session.id, { protocol: 'Incidental' });
    [line] = await lines([(await db.sessions.get(session.id))!]);
    expect(column(line, 'Protocol')).toBe('Incidental');
    expect(column(line, 'Duration')).toBe('');
  });

  it('haalt komma’s, aanhalingstekens en regeleindes uit de tekst', async () => {
    await db.observations.add(observation({ position, remarks: 'zat op het hek,\n"met ring"' }));
    await db.sessions.update(session.id, {
      place: { name: 'Utrecht, Lage Weide', source: 'hand' },
    });
    const [line] = await lines([(await db.sessions.get(session.id))!]);
    expect(line).toHaveLength(19);
    expect(column(line, 'Location Name')).toBe('Utrecht; Lage Weide');
    expect(column(line, 'Species Comments')).toBe('1 (zat op het hek; met ring)');
  });

  it('laat uitgevinkte waarnemingen eruit en neemt onzekere mee met een waarschuwing', async () => {
    await db.observations.bulkAdd([
      observation({ position, uncertain: true }),
      observation({ speciesId: HOUTDUIF, position, skipExport: true }),
    ]);
    const result = await buildEbirdExport([session]);
    expect(result.rows).toBe(1);
    expect(result.excluded).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('1 waarneming is nog onzeker');
  });

  it('plek van de eerste uitspraak als geen waarneming een positie heeft', async () => {
    await db.observations.add(observation());
    const utterance: Utterance = {
      id: 'u1',
      sessionId: session.id,
      recordedAt: session.startedAt,
      position: { ...position, lat: 52.1 },
      status: 'done',
    };
    await db.utterances.add(utterance);
    const [line] = await lines();
    expect(column(line, 'Latitude')).toBe('52.100000');
  });

  it('meldt wat er nog ontbreekt', async () => {
    await db.observations.add(observation({ position }));
    await db.sessions.update(session.id, {
      checklist: { protocol: 'Traveling' },
      effort: undefined,
    });
    const result = await buildEbirdExport([(await db.sessions.get(session.id))!]);
    expect(result.problems).toEqual([
      'vul eerst in of je alles hebt genoteerd.',
      'een lopende telling heeft een afstand nodig.',
    ]);
  });

  it('waarschuwt bij een lange lopende telling en over middernacht', async () => {
    await db.observations.add(observation({ position }));
    const long: Session = {
      ...session,
      endedAt: Date.parse('2026-11-13T00:30:00'),
      effort: { activeMs: 60 * 60_000, distanceM: 12_000 },
    };
    const result = await buildEbirdExport([long]);
    expect(result.warnings.join(' ')).toContain('langer dan 8 km');
    expect(result.warnings.join(' ')).toContain('over middernacht');
  });

  it('meer sessies: een checklist per sessie in één bestand', async () => {
    const other: Session = { ...session, id: 'ander', startedAt: session.startedAt + 86_400_000 };
    await db.sessions.put(other);
    await db.observations.bulkAdd([
      observation({ position }),
      observation({ sessionId: 'ander', position }),
    ]);
    const result = await buildEbirdExport([other, session]);
    expect(result.rows).toBe(2);
    expect(result.filename).toBe('ebird-2026-11-12-tot-2026-11-13-2-sessies.csv');
    const [first, second] = await lines([other, session]);
    expect(column(first, 'Date')).toBe('11/12/2026');
    expect(column(second, 'Date')).toBe('11/13/2026');
  });
});

describe('resolveChecklist', () => {
  it('kiest het protocol uit de afstand, en Incidental zonder gemeten afstand', () => {
    expect(resolveChecklist(session).protocol).toBe('Traveling');
    expect(resolveChecklist({ ...session, effort: undefined }).protocol).toBe('Incidental');
    expect(resolveChecklist({ ...session, checklist: { distanceM: 10 } }).protocol).toBe(
      'Stationary',
    );
  });

  it('onthoudt het laatste aantal waarnemers', async () => {
    expect(lastObservers()).toBe(1);
    await setChecklist(session.id, { observers: 2 });
    expect(lastObservers()).toBe(2);
    expect(resolveChecklist({ ...session, checklist: {} }).observers).toBe(2);
  });

  it('wist een veld met undefined', async () => {
    await setChecklist(session.id, { protocol: 'Stationary' });
    await setChecklist(session.id, { protocol: undefined });
    expect((await db.sessions.get(session.id))?.checklist).toEqual({ complete: true });
  });
});

describe('exportForEbird', () => {
  it('slaat op en markeert de sessie', async () => {
    await db.observations.add(observation({ position }));
    saveFile.mockResolvedValue({});
    const message = await exportForEbird([session]);
    expect(message).toBe('1 soort geëxporteerd voor eBird.');
    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), 'ebird-2026-11-12-0805.csv');
    expect((await db.sessions.get(session.id))?.ebirdExportedAt).toBeTypeOf('number');
  });

  it('exporteert niet zolang er iets ontbreekt', async () => {
    await db.observations.add(observation({ position }));
    saveFile.mockClear();
    const message = await exportForEbird([{ ...session, checklist: {} }]);
    expect(message).toContain('vul eerst in of je alles hebt genoteerd');
    expect(saveFile).not.toHaveBeenCalled();
  });
});

describe('clean', () => {
  it('maakt van alles één regel zonder komma’s en aanhalingstekens', () => {
    expect(clean(' a,  "b"\r\n“c” ')).toBe('a; b c');
  });
});

describe('pendingForEbird', () => {
  const since = session.startedAt;
  const ready: Session = { ...session, readyAt: session.endedAt, checklist: undefined };
  const ids = (sessions: Session[], from: number | undefined = since) =>
    pendingForEbird(sessions, from).map((s) => s.id);

  it('neemt nagelopen sessies: klaar, of al naar waarneming.nl', () => {
    const exported: Session = { ...ready, id: 'wnl', readyAt: undefined, exportedAt: 1 };
    const notReviewed: Session = { ...ready, id: 'open', readyAt: undefined };
    const active: Session = { ...ready, id: 'loopt', status: 'active' };
    expect(ids([ready, exported, notReviewed, active])).toEqual(['sessie', 'wnl']);
  });

  it('slaat over wat al naar eBird is of er niet heen hoeft', () => {
    const done: Session = { ...ready, id: 'al', ebirdExportedAt: 1 };
    const skipped: Session = { ...ready, id: 'tuin', checklist: { skipEbird: true } };
    expect(ids([done, skipped])).toEqual([]);
  });

  it('neemt een sessie van vóór het aanzetten alleen met een antwoord op "alles genoteerd?"', () => {
    const old: Session = { ...ready, id: 'oud', startedAt: since - 9000, endedAt: since - 1 };
    const answered: Session = { ...old, id: 'beantwoord', checklist: { complete: false } };
    expect(ids([old, answered])).toEqual(['beantwoord']);
    // Niet bekend sinds wanneer: dan alleen de beantwoorde
    expect(pendingForEbird([ready, answered], undefined)).toEqual([answered]);
  });
});
