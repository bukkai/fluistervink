import { registerSW } from 'virtual:pwa-register';
import { logEvent } from './log';
import { getActiveSession } from './sessions';

/**
 * Nieuwe versie van de app pas laden als er geen wandeling loopt. Een update
 * herlaadt de pagina, en midden in een wandeling kost dat een lopende opname
 * en de warme GPS (bij de tweede wandeling herlaadde de app vier keer).
 *
 * De nieuwe versie staat dan klaar (service worker "waiting") en wordt geladen
 * zodra er geen wandeling loopt: meteen bij het opstarten, of anders zodra je
 * na de wandeling de app verlaat (niemand ziet het herladen).
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
});

async function applyUpdateIfIdle(moment: 'start' | 'hidden'): Promise<void> {
  if (!waiting) return;
  if (await getActiveSession()) {
    // Alleen de eerste keer; verborgen gebeurt tijdens een wandeling tientallen keren
    if (moment === 'start') logEvent('update_deferred');
    return;
  }
  waiting = false;
  logEvent('update_applied', { moment });
  await updateSW(true);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) applyUpdateIfIdle('hidden');
});
