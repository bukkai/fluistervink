import { logEvent } from './log';
import {
  isNativeApp,
  startSessionService,
  stopSessionService,
  sessionServiceStatus,
} from './native';

// Houdt de foreground service van de Android-app gelijk met de lopende
// sessie (fase 2, docs/plan-capacitor.md). Aanroepen bij elke wijziging van
// de lopende sessie, bij terugkomen in de app en bij het begin van een
// opname: de service start alleen als de app op het scherm staat en de
// locatietoestemming er is, dus bij de eerste sessie lukt het pas later.

// De gebeurtenissen in het log heten nog `walk_service_…`, zoals in de logs
// van eerdere sessies, zodat die naast elkaar te lezen blijven.

/** Laatst gelogde uitkomst, zodat het log niet bij elke opname een regel krijgt */
let lastLogged = '';

export async function syncSessionService(sessionId: string | undefined): Promise<void> {
  if (!isNativeApp) return;
  if (!sessionId) {
    await stopSessionService();
    if (lastLogged) logEvent('walk_service_stopped');
    lastLogged = '';
    return;
  }

  const result = await startSessionService();
  const key = JSON.stringify(result);
  if (key !== lastLogged) logEvent('walk_service_started', result, { sessionId });
  lastLogged = key;
  if (!result.ok) return;

  // Of startForeground echt lukte, weet de service pas iets later
  setTimeout(async () => {
    const status = await sessionServiceStatus();
    if (!status.draait) {
      logEvent('walk_service_failed', status, { sessionId });
      lastLogged = '';
    }
  }, 2000);
}
