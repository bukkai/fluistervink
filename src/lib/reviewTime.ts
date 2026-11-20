import { db } from './db';

// Hoe lang het nalopen van een sessie duurde, voor de samenvatting: "42
// waarnemingen, nagelopen in 3 minuten". Telt de tijd dat het scherm van de
// sessie in beeld is, vanaf het openen (ook meteen na Stop) tot "Alles klopt".
// Alleen actieve tijd: wie het scherm laat liggen, telt niet door.

/** Langer dan dit niets aangeraakt: telt maar tot hier (even terugluisteren of kijken wel) */
export const IDLE_CAP_MS = 2 * 60_000;

/**
 * Telt de tijd tussen aanrakingen, elk gat hooguit `IDLE_CAP_MS`. Los van het
 * scherm, om te testen.
 */
export class ReviewClock {
  private last?: number;
  private total = 0;

  /** Iets aangeraakt, of het scherm kwam in beeld */
  activity(now: number): void {
    if (this.last !== undefined) this.total += Math.min(now - this.last, IDLE_CAP_MS);
    this.last = now;
  }

  /** Scherm uit beeld of weg: de tijd tot nu telt, daarna niets tot de volgende aanraking */
  pause(now: number): void {
    this.activity(now);
    this.last = undefined;
  }

  /** Geteld sinds de vorige keer, en weer op nul */
  take(): number {
    const total = this.total;
    this.total = 0;
    return total;
  }
}

/** Telt `ms` op bij de nalooptijd van de sessie. */
export async function addReviewTime(sessionId: string, ms: number): Promise<void> {
  if (ms <= 0) return;
  await db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      s.reviewMs = (s.reviewMs ?? 0) + ms;
    });
}

const ACTIVITY = ['pointerdown', 'keydown', 'scroll'] as const;

/**
 * Begint te tellen voor deze sessie; geeft een functie terug die stopt en
 * wegschrijft. Bij uit beeld gaan (andere app, scherm op slot) wordt ook
 * weggeschreven, want daarna kan de app zonder waarschuwing gesloten worden.
 */
export function trackReviewTime(sessionId: string): () => void {
  const clock = new ReviewClock();
  const save = () => addReviewTime(sessionId, clock.take()).catch(() => {});
  const onActivity = () => clock.activity(Date.now());
  const onVisibility = () => {
    if (document.hidden) {
      clock.pause(Date.now());
      void save();
    } else clock.activity(Date.now());
  };

  if (!document.hidden) clock.activity(Date.now());
  for (const type of ACTIVITY)
    window.addEventListener(type, onActivity, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    for (const type of ACTIVITY) window.removeEventListener(type, onActivity, { capture: true });
    document.removeEventListener('visibilitychange', onVisibility);
    if (!document.hidden) clock.pause(Date.now());
    void save();
  };
}

/** Nalooptijd in hele minuten voor op het scherm; 0 = minder dan een minuut. */
export function reviewMinutes(ms: number): number {
  return Math.round(ms / 60_000);
}
