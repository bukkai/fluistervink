import { registerSW } from 'virtual:pwa-register';
import { logEvent } from './log';
import { getActiveSession } from './sessions';
import { updateStatus } from './updateMelding.svelte';

/**
 * Nieuwe versie van de app pas laden als er geen sessie loopt. Een update
 * herlaadt de pagina, en midden in een sessie kost dat een lopende opname
 * en de warme GPS (bij de tweede sessie herlaadde de app vier keer).
 *
 * De nieuwe versie staat dan klaar (service worker "waiting") en wordt geladen
 * zodra er geen sessie loopt: meteen bij het opstarten, of anders zodra je
 * na de sessie de app verlaat (niemand ziet het herladen).
 *
 * Een nieuwe versie wordt alleen bij het opstarten gevonden (geen periodieke
 * controle), dus testen: deploy, app helemaal afsluiten en opnieuw openen.
 */
let waiting = false;

const updateSW = registerSW({
  onNeedRefresh() {
    waiting = true;
    applyUpdateIfIdle('start');
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    if (registration.installing) showLoading(registration.installing);
    registration.addEventListener('updatefound', () => {
      if (registration.installing) showLoading(registration.installing);
    });
  },
});

/**
 * Balkje onderin zolang een nieuwe versie binnenkomt. Niet bij de allereerste
 * installatie (dan is er nog geen oude versie) en niet tijdens een sessie: de
 * update wacht dan toch tot na de sessie.
 */
async function showLoading(worker: ServiceWorker): Promise<void> {
  if (!navigator.serviceWorker.controller || (await getActiveSession())) return;
  updateStatus.loading = true;
  worker.addEventListener('statechange', () => {
    // Bij "installed" volgt onNeedRefresh, die herlaadt (of wacht op een sessie)
    if (worker.state === 'redundant') updateStatus.loading = false;
  });
}

async function applyUpdateIfIdle(moment: 'start' | 'hidden'): Promise<void> {
  if (!waiting) return;
  if (await getActiveSession()) {
    // Alleen de eerste keer; verborgen gebeurt tijdens een sessie tientallen keren
    if (moment === 'start') logEvent('update_deferred');
    updateStatus.loading = false;
    return;
  }
  waiting = false;
  logEvent('update_applied', { moment });
  await updateSW(true);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) applyUpdateIfIdle('hidden');
});
