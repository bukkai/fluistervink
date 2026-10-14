import { logEvent } from './log';
import { isNativeApp, startWalkService, stopWalkService, walkServiceStatus } from './native';

// Houdt de foreground service van de Android-app gelijk met de lopende
// wandeling (fase 2, docs/plan-capacitor.md). Aanroepen bij elke wijziging van
// de lopende wandeling, bij terugkomen in de app en bij het begin van een
// opname: de service start alleen als de app op het scherm staat en de
// locatietoestemming er is, dus bij de eerste wandeling lukt het pas later.

/** Laatst gelogde uitkomst, zodat het log niet bij elke opname een regel krijgt */
let lastLogged = '';

export async function syncWalkService(sessionId: string | undefined): Promise<void> {
  if (!isNativeApp) return;
  if (!sessionId) {
    await stopWalkService();
    if (lastLogged) logEvent('walk_service_stopped');
    lastLogged = '';
    return;
  }

  const result = await startWalkService();
  const key = JSON.stringify(result);
  if (key !== lastLogged) logEvent('walk_service_started', result, { sessionId });
  lastLogged = key;
  if (!result.ok) return;

  // Of startForeground echt lukte, weet de service pas iets later
  setTimeout(async () => {
    const status = await walkServiceStatus();
    if (!status.draait) {
      logEvent('walk_service_failed', status, { sessionId });
      lastLogged = '';
    }
  }, 2000);
}
