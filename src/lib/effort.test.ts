import { describe, expect, it } from 'vitest';
import { db, type Position } from './db';
import {
  distanceStep,
  ebirdProtocol,
  recordFix,
  resumedEffort,
  sessionDurationMs,
  stoppedEffort,
} from './effort';
import { resumeSession, startSession, stopSession } from './sessions';

// Afstand en duur van een sessie, voor eBird (docs/plan-ebird.md)

/** Een meting `north` meter ten noorden van een vast punt, op `seconds` */
function fix(north: number, accuracy = 5, seconds = 0): Position {
  return { lat: 52 + north / 111_195, lon: 5, accuracy, fixedAt: seconds * 1000 };
}

describe('distanceStep', () => {
  it('eerste meting wordt het ankerpunt', () => {
    expect(distanceStep(undefined, fix(0))).toEqual({ kind: 'anchor', anchor: fix(0), addM: 0 });
  });

  it('telt een onnauwkeurige meting niet mee', () => {
    expect(distanceStep(fix(0), fix(500, 60, 600)).kind).toBe('inaccurate');
    expect(distanceStep(undefined, fix(0, 60)).kind).toBe('inaccurate');
  });

  it('negeert GPS-ruis bij stilstaan', () => {
    expect(distanceStep(fix(0, 5), fix(15, 5, 60)).kind).toBe('small');
    // Groter dan 20 m, maar binnen de onnauwkeurigheid van beide samen
    expect(distanceStep(fix(0, 20), fix(35, 20, 60)).kind).toBe('small');
  });

  it('vervangt het ankerpunt door een nauwkeuriger meting vlakbij', () => {
    const step = distanceStep(fix(0, 30), fix(10, 5, 60));
    expect(step).toEqual({ kind: 'better', anchor: fix(10, 5, 60), addM: 0 });
  });

  it('telt een echte stap', () => {
    const step = distanceStep(fix(0), fix(100, 5, 60));
    expect(step.kind).toBe('counted');
    expect('addM' in step && step.addM).toBeCloseTo(100, 0);
  });

  it('negeert een sprong van de GPS', () => {
    expect(distanceStep(fix(0), fix(2000, 5, 10)).kind).toBe('jump');
  });
});

describe('duur', () => {
  const effort = { activeMs: 0, activeSince: 1000, distanceM: 0 };

  it('telt het lopende stuk op bij het stoppen, zonder ankerpunt', () => {
    expect(stoppedEffort({ ...effort, anchor: fix(0) }, 61_000)).toEqual({
      activeMs: 60_000,
      distanceM: 0,
    });
  });

  it('telt de tijd tussen stoppen en voortzetten niet mee', () => {
    const stopped = stoppedEffort(effort, 61_000);
    const resumed = resumedEffort(stopped, 1_000_000);
    const session = { id: 's', startedAt: 1000, status: 'active' as const, effort: resumed };
    expect(sessionDurationMs(session, 1_030_000)).toBe(90_000);
  });

  it('valt terug op begin en eind bij oude sessies', () => {
    const session = { id: 's', startedAt: 1000, endedAt: 61_000, status: 'ended' as const };
    expect(sessionDurationMs(session)).toBe(60_000);
  });
});

describe('ebirdProtocol', () => {
  it('kiest op de afstand', () => {
    expect(ebirdProtocol({ activeMs: 0, distanceM: 30 })).toBe('Stationary');
    expect(ebirdProtocol({ activeMs: 0, distanceM: 800 })).toBe('Traveling');
  });
});

describe('een sessie', () => {
  it('houdt duur en afstand bij, ook na voortzetten', async () => {
    const session = await startSession();
    expect(session.effort).toEqual({ activeMs: 0, activeSince: session.startedAt, distanceM: 0 });

    expect(await recordFix(session.id, fix(0, 5, 0))).toBe('anchor');
    expect(await recordFix(session.id, fix(150, 5, 120))).toBe('counted');
    expect(await recordFix(session.id, fix(500, 80, 180))).toBe('inaccurate');

    await stopSession(session.id, session.startedAt + 600_000);
    let stored = await db.sessions.get(session.id);
    expect(stored?.effort?.activeMs).toBe(600_000);
    expect(stored?.effort?.distanceM).toBeCloseTo(150, 0);
    expect(stored?.effort?.anchor).toBeUndefined();
    // Na het stoppen telt niets meer
    expect(await recordFix(session.id, fix(400, 5, 300))).toBeUndefined();

    // Voortzetten: de plek waar je weer begint telt niet als afgelegd
    await resumeSession(session.id);
    expect(await recordFix(session.id, fix(5000, 5, 4000))).toBe('anchor');
    stored = await db.sessions.get(session.id);
    expect(stored?.effort?.distanceM).toBeCloseTo(150, 0);
  });
});
