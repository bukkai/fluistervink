import { beforeEach, describe, expect, it } from 'vitest';
import { db, type Session } from './db';
import { importJson } from './export';
import { startSession } from './sessions';
import {
  TELWEEKEND,
  TUINTEL_FOR_EVERYONE,
  TUINTEL_FORM_SPECIES,
  dismissTelweekendNotice,
  isTelweekend,
  showTelweekendNotice,
  tuintelAvailable,
  TUINTEL_MS,
  startTuintelCount,
  tuintelLeftMs,
  tuintelPhase,
  tuintelResult,
  tuintelText,
} from './tuintelling';
import { getSpecies } from './vocab';
import { HOUTDUIF, REE, VINK, observation } from '../test-helpers';

// Tuintelling: per soort het hoogste aantal, zonder overvliegers
// (docs/plan-tuintelling.md)

const KOOLMEES = 140;
const MEREL = 150;
const APPELVINK = 59;
const MEES_ONBEKEND = 643256;
const OVERVLIEGEND = 6;
const OVERVLIEGEND_NOORD = 11;

describe('TUINTEL_FORM_SPECIES', () => {
  it('zijn de 25 vaste soorten, allemaal echte soorten uit onze lijst', () => {
    expect(TUINTEL_FORM_SPECIES).toHaveLength(25);
    for (const { id, name } of TUINTEL_FORM_SPECIES) {
      // Zelfde naam, alleen de hoofdletters kunnen verschillen
      expect(getSpecies(id)?.name.toLowerCase()).toBe(name.toLowerCase());
    }
  });

  it('staan op alfabet, zoals op de tellijst', () => {
    const names = TUINTEL_FORM_SPECIES.map((s) => s.name);
    expect([...names].sort((a, b) => a.localeCompare(b, 'nl'))).toEqual(names);
  });
});

describe('tuintelResult', () => {
  it('neemt per soort het hoogste aantal, niet de som', () => {
    const result = tuintelResult([
      observation({ speciesId: KOOLMEES, count: 3 }),
      observation({ speciesId: KOOLMEES, count: 5 }),
      observation({ speciesId: KOOLMEES, count: 2 }),
    ]);
    expect(result.form).toEqual([expect.objectContaining({ speciesId: KOOLMEES, count: 5 })]);
  });

  it('zet de vaste soorten in de volgorde van het formulier', () => {
    const result = tuintelResult([
      observation({ speciesId: VINK }),
      observation({ speciesId: MEREL }),
      observation({ speciesId: HOUTDUIF }),
    ]);
    expect(result.form.map((l) => l.formName)).toEqual(['Houtduif', 'Merel', 'Vink']);
  });

  it('zet andere soorten apart, om zelf toe te voegen', () => {
    const result = tuintelResult([
      observation({ speciesId: MEREL }),
      observation({ speciesId: APPELVINK, count: 2 }),
    ]);
    expect(result.form.map((l) => l.speciesId)).toEqual([MEREL]);
    expect(result.extra).toEqual([expect.objectContaining({ speciesId: APPELVINK, count: 2 })]);
  });

  it('telt overvliegers niet mee, maar laat ze wel zien', () => {
    const result = tuintelResult([
      observation({ speciesId: HOUTDUIF, count: 6, activityId: OVERVLIEGEND }),
      observation({ speciesId: HOUTDUIF, count: 8, activityId: OVERVLIEGEND_NOORD }),
    ]);
    expect(result.form).toEqual([]);
    expect(result.flyovers).toEqual([expect.objectContaining({ speciesId: HOUTDUIF, count: 8 })]);
  });

  it('een soort die ook in de tuin zat, telt alleen met het aantal in de tuin', () => {
    const result = tuintelResult([
      observation({ speciesId: HOUTDUIF, count: 6, activityId: OVERVLIEGEND }),
      observation({ speciesId: HOUTDUIF, count: 2 }),
    ]);
    expect(result.form).toEqual([expect.objectContaining({ speciesId: HOUTDUIF, count: 2 })]);
    expect(result.flyovers).toEqual([]);
  });

  it('zet een verzamelsoort apart: die kan niet in het formulier', () => {
    const result = tuintelResult([observation({ speciesId: MEES_ONBEKEND, count: 2 })]);
    expect(result.unknown).toEqual([expect.objectContaining({ speciesId: MEES_ONBEKEND })]);
    expect(result.form).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it('laat andere dieren en uitgevinkte waarnemingen weg', () => {
    const result = tuintelResult([
      observation({ speciesId: REE }),
      observation({ speciesId: MEREL, skipExport: true }),
    ]);
    expect(result).toEqual({ form: [], extra: [], unknown: [], flyovers: [] });
  });

  it('onthoudt dat een soort nog onzeker is', () => {
    const result = tuintelResult([
      observation({ speciesId: MEREL, count: 2 }),
      observation({ speciesId: MEREL, count: 1, uncertain: true }),
    ]);
    expect(result.form[0]).toMatchObject({ count: 2, uncertain: true });
  });
});

describe('tuintelText', () => {
  it('geeft de vaste soorten en daarna wat je zelf toevoegt', () => {
    const result = tuintelResult([
      observation({ speciesId: KOOLMEES, count: 5 }),
      observation({ speciesId: APPELVINK }),
      observation({ speciesId: MEES_ONBEKEND }),
      observation({ speciesId: HOUTDUIF, activityId: OVERVLIEGEND }),
    ]);
    expect(tuintelText(result, { header: 'Tuintelling', extraHeader: 'Zelf toevoegen:' })).toBe(
      'Tuintelling\nKoolmees 5\n\nZelf toevoegen:\nAppelvink 1',
    );
  });
});

describe('tuintelLeftMs en tuintelPhase', () => {
  const tuin = (extra: Partial<Session> = {}): Session => ({
    id: 's',
    startedAt: 0,
    status: 'active',
    tuintelling: true,
    ...extra,
  });

  it('loopt pas als het tellen begonnen is, niet vanaf de start van de sessie', () => {
    expect(tuintelLeftMs(tuin(), 10 * 60_000)).toBeUndefined();
    expect(tuintelPhase(tuin(), 10 * 60_000)).toBe('before');
    const counting = tuin({ tuintelStartedAt: 5 * 60_000 });
    expect(tuintelLeftMs(counting, 10 * 60_000)).toBe(TUINTEL_MS - 5 * 60_000);
    expect(tuintelPhase(counting, 10 * 60_000)).toBe('counting');
  });

  it('na het half uur, of voortgezet na afloop: nog iets vergeten', () => {
    const start = 60_000;
    expect(tuintelPhase(tuin({ tuintelStartedAt: start }), start + TUINTEL_MS)).toBe('after');
    const resumed = tuin({ tuintelStartedAt: start, resumedAt: start + TUINTEL_MS + 60_000 });
    expect(tuintelPhase(resumed, start + TUINTEL_MS + 90_000)).toBe('after');
  });

  it('een gewone sessie heeft geen klok', () => {
    const gewoon: Session = { id: 's', startedAt: 0, status: 'active' };
    expect(tuintelLeftMs(gewoon, 60_000)).toBeUndefined();
    expect(tuintelPhase(gewoon, 60_000)).toBeUndefined();
  });

  it('een oude tuintelling zonder begin van het tellen telt vanaf de start', () => {
    expect(tuintelLeftMs(tuin({ status: 'ended' }), 60_000)).toBe(TUINTEL_MS - 60_000);
  });
});

describe('startTuintelCount', () => {
  it('zet het begin één keer, alleen bij een tuintelling', async () => {
    const tuin = await startSession({ tuintelling: true });
    await startTuintelCount(tuin.id, 1000);
    await startTuintelCount(tuin.id, 2000);
    expect((await db.sessions.get(tuin.id))?.tuintelStartedAt).toBe(1000);

    await db.sessions.clear();
    const gewoon = await startSession();
    await startTuintelCount(gewoon.id, 1000);
    expect((await db.sessions.get(gewoon.id))?.tuintelStartedAt).toBeUndefined();
  });
});

describe('tuintelsessie', () => {
  it('startSession zet de vlag alleen als erom gevraagd wordt', async () => {
    const gewoon = await startSession();
    expect(gewoon.tuintelling).toBeUndefined();
    await db.sessions.clear();
    const tuin = await startSession({ tuintelling: true });
    expect((await db.sessions.get(tuin.id))?.tuintelling).toBe(true);
  });

  it('een back-up met een tuintelsessie is in te lezen, een rare vlag niet', async () => {
    const backup = (tuintelling: unknown) =>
      new File(
        [
          JSON.stringify({
            sessions: [{ id: 's1', startedAt: 1, status: 'ended', tuintelling }],
            utterances: [],
            observations: [],
          }),
        ],
        'export.json',
      );
    await expect(importJson(backup('ja'))).rejects.toThrow();
    await importJson(backup(true));
    expect((await db.sessions.get('s1'))?.tuintelling).toBe(true);
  });

  it('het begin van het tellen gaat mee in een back-up, als getal', async () => {
    const backup = (tuintelStartedAt: unknown) =>
      new File(
        [
          JSON.stringify({
            sessions: [
              { id: 's2', startedAt: 1, status: 'ended', tuintelling: true, tuintelStartedAt },
            ],
            utterances: [],
            observations: [],
          }),
        ],
        'export.json',
      );
    await expect(importJson(backup('nu'))).rejects.toThrow();
    await importJson(backup(5));
    expect((await db.sessions.get('s2'))?.tuintelStartedAt).toBe(5);
  });
});

describe('rond het telweekend', () => {
  const at = (month: number, day: number, hour = 12) => new Date(2027, month, day, hour).getTime();
  const donderdag = at(0, 28, 23);
  const vrijdag = at(0, 29, 0);
  const zondagAvond = at(0, 31, 23);
  const maandag = at(1, 1, 0);

  beforeEach(() => localStorage.clear());

  it('is nog niet voor iedereen: dat is de lancering (stap 5)', () => {
    expect(TUINTEL_FOR_EVERYONE).toBe(false);
    expect(tuintelAvailable(vrijdag, false)).toBe(false);
  });

  it('kan met de ontwikkeloptie altijd', () => {
    expect(tuintelAvailable(at(5, 1), true)).toBe(true);
  });

  it('toont de knop voor iedereen van een week ervoor tot en met zondag', () => {
    expect(tuintelAvailable(at(0, 21, 23), false, true)).toBe(false);
    expect(tuintelAvailable(TELWEEKEND.buttonFrom, false, true)).toBe(true);
    expect(tuintelAvailable(zondagAvond, false, true)).toBe(true);
    expect(tuintelAvailable(maandag, false, true)).toBe(false);
  });

  it('kent het telweekend als vrijdag tot en met zondag', () => {
    expect(isTelweekend(donderdag)).toBe(false);
    expect(isTelweekend(vrijdag)).toBe(true);
    expect(isTelweekend(zondagAvond)).toBe(true);
    expect(isTelweekend(maandag)).toBe(false);
  });

  it('meldt het telweekend tot je hem wegtikt of al telde', () => {
    expect(showTelweekendNotice(donderdag, true, [])).toBe(false);
    expect(showTelweekendNotice(vrijdag, false, [])).toBe(false);
    expect(showTelweekendNotice(vrijdag, true, [])).toBe(true);
    // Een tuintelling van vorige week (proberen) telt niet, een van dit weekend wel
    expect(showTelweekendNotice(vrijdag, true, [{ tuintelling: true, startedAt: donderdag }])).toBe(
      true,
    );
    expect(
      showTelweekendNotice(zondagAvond, true, [{ tuintelling: true, startedAt: vrijdag }]),
    ).toBe(false);
    expect(showTelweekendNotice(zondagAvond, true, [{ startedAt: vrijdag }])).toBe(true);
    dismissTelweekendNotice();
    expect(showTelweekendNotice(vrijdag, true, [])).toBe(false);
  });
});
