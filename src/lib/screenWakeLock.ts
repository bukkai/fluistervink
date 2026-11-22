// Scherm aan houden tijdens een sessie (instelling `schermAan`, feedback 20 nov:
// "zoals bij kookapps", zodat je met de volumeknop kunt blijven inspreken).
// Met de Screen Wake Lock API, net als de trektelling (trektelRecorder.svelte.ts).
// De browser laat het slot los zodra de app uit beeld gaat (ander scherm, of
// met de aan-uitknop op slot); bij terugkomen vragen we het opnieuw. Op slot
// zetten met de aan-uitknop blijft dus gewoon werken.

export const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/**
 * Houdt het scherm aan tot de teruggegeven functie wordt aangeroepen.
 * `log` krijgt een fout als de browser het weigert (bijvoorbeeld bij een lage accu).
 */
export function holdScreenOn(log: (type: string, data?: Record<string, unknown>) => void) {
  if (!wakeLockSupported) return () => {};
  let sentinel: WakeLockSentinel | undefined;
  let stopped = false;

  async function request() {
    if (stopped || document.hidden || (sentinel && !sentinel.released)) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // Intussen gestopt: meteen weer loslaten
      if (stopped) void lock.release().catch(() => {});
      else sentinel = lock;
    } catch (error) {
      log('wake_lock_error', { message: (error as Error).message, via: 'schermAan' });
    }
  }

  const onVisibility = () => void request();
  document.addEventListener('visibilitychange', onVisibility);
  void request();

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release().catch(() => {});
    sentinel = undefined;
  };
}
