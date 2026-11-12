import { db, type Effort, type Position, type Session } from './db';
import { distanceMeters } from './geo';

// Inspanning van een sessie: hoe lang en hoe ver er gevogeld is, voor een
// eBird-checklist (docs/plan-ebird.md). De afstand werkt als een
// kilometerteller op de GPS die tijdens een sessie toch al aanstaat: de app
// telt alleen op, en bewaart geen route. Alleen de laatst meegetelde meting
// (het ankerpunt) staat bij de lopende sessie, zodat een herstart van de app
// de afstand niet kwijtraakt; bij het stoppen gaat die weg.

/** Metingen die onnauwkeuriger zijn dan dit, tellen niet mee */
export const MAX_ACCURACY_M = 50;
/** Kleinere stappen tellen niet mee: GPS-ruis bij stilstaan */
const MIN_STEP_M = 20;
/** Sneller dan dit (180 km/u) is een sprong van de GPS, geen verplaatsing */
const MAX_SPEED_MS = 50;
/** Tot deze afstand telt een sessie als op één plek (eBird: Stationary) */
export const STATIONARY_MAX_M = 50;

export type DistanceStep =
  | { kind: 'anchor' | 'better' | 'counted'; anchor: Position; addM: number }
  | { kind: 'inaccurate' | 'small' | 'jump' };

/**
 * Wat een nieuwe GPS-meting doet met de teller. Een stap telt pas als hij
 * groter is dan de onnauwkeurigheid van beide metingen samen (en minstens
 * 20 m); dan wordt de meting het nieuwe ankerpunt. Een nauwkeuriger meting
 * vlakbij vervangt het ankerpunt zonder iets op te tellen.
 */
export function distanceStep(anchor: Position | undefined, fix: Position): DistanceStep {
  if (fix.accuracy > MAX_ACCURACY_M) return { kind: 'inaccurate' };
  if (!anchor) return { kind: 'anchor', anchor: fix, addM: 0 };
  const meters = distanceMeters(anchor, fix);
  if (meters < Math.max(MIN_STEP_M, anchor.accuracy + fix.accuracy)) {
    return fix.accuracy < anchor.accuracy
      ? { kind: 'better', anchor: fix, addM: 0 }
      : { kind: 'small' };
  }
  const seconds = (fix.fixedAt - anchor.fixedAt) / 1000;
  if (seconds > 0 && meters / seconds > MAX_SPEED_MS) return { kind: 'jump' };
  return { kind: 'counted', anchor: fix, addM: meters };
}

/** Inspanning van een nieuwe sessie */
export function newEffort(at: number): Effort {
  return { activeMs: 0, activeSince: at, distanceM: 0 };
}

/** Bij het stoppen: het lopende stuk optellen, ankerpunt weg */
export function stoppedEffort(effort: Effort, endedAt: number): Effort {
  const { activeSince, anchor: _anchor, ...rest } = effort;
  const ms = activeSince === undefined ? 0 : Math.max(0, endedAt - activeSince);
  return { ...rest, activeMs: effort.activeMs + ms };
}

/** Bij voortzetten: nieuw stuk, en de tussentijd telt niet mee (ook de afstand niet) */
export function resumedEffort(effort: Effort, at: number): Effort {
  const { anchor: _anchor, ...rest } = effort;
  return { ...rest, activeSince: at };
}

/**
 * Hoe lang er gevogeld is. Sessies van vóór de inspanning: van begin tot
 * eind. Een lopende sessie telt tot `now`.
 */
export function sessionDurationMs(session: Session, now = Date.now()): number {
  const effort = session.effort;
  if (!effort) return (session.endedAt ?? now) - session.startedAt;
  const running = effort.activeSince === undefined ? 0 : Math.max(0, now - effort.activeSince);
  return effort.activeMs + running;
}

/** eBird-protocol dat bij de sessie past: op één plek of onderweg */
export function ebirdProtocol(effort: Effort): 'Stationary' | 'Traveling' {
  return effort.distanceM < STATIONARY_MAX_M ? 'Stationary' : 'Traveling';
}

/**
 * Een GPS-meting tijdens de lopende sessie meetellen. Geeft terug wat de
 * meting deed (voor de telling in het log), of niets als de sessie niet
 * (meer) loopt of nog geen inspanning bijhoudt.
 */
export async function recordFix(
  sessionId: string,
  fix: Position,
): Promise<DistanceStep['kind'] | undefined> {
  // Zonder de database: dit komt vaak voor bij slecht bereik
  if (fix.accuracy > MAX_ACCURACY_M) return 'inaccurate';
  return db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId);
    if (session?.status !== 'active' || !session.effort) return undefined;
    const step = distanceStep(session.effort.anchor, fix);
    if ('anchor' in step) {
      await db.sessions.update(sessionId, {
        effort: {
          ...session.effort,
          anchor: step.anchor,
          distanceM: session.effort.distanceM + step.addM,
        },
      });
    }
    return step.kind;
  });
}
