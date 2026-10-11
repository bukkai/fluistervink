import { db } from './db';

// Eén exemplaar van de app tegelijk. Staat Fluistervink zowel in een gewoon
// Chrome-tabblad als in de geïnstalleerde app open, dan zitten die elkaar in
// de weg: een bevroren tabblad op de achtergrond kan de database vasthouden
// (verwerking minutenlang stil, 11 okt), en beide draaien een eigen wachtrij.
// Daarom: het exemplaar dat opstart of zichtbaar wordt, neemt het over. De
// andere sluiten de database en tonen een melding; worden ze weer zichtbaar,
// dan laden ze opnieuw en nemen het op hun beurt over.

/** Willekeurig kenmerk van dit exemplaar, in elke gebeurtenis in de log. */
export const INSTANCE_ID = crypto.randomUUID().slice(0, 8);

/** Toestand voor de interface. */
export const instance = $state({
  /** Een ander exemplaar heeft het overgenomen; dit exemplaar doet niets meer */
  dormant: false,
});

const channel = 'BroadcastChannel' in window ? new BroadcastChannel('fluistervink') : undefined;

/** Eén keer bij het opstarten aanroepen (vanuit `startLogging`). */
export function claimInstance(): void {
  channel?.postMessage({ type: 'claim', id: INSTANCE_ID });
  channel?.addEventListener('message', async (event) => {
    if (event.data?.type !== 'claim' || instance.dormant) return;
    instance.dormant = true;
    // Rechtstreeks (niet via logEvent), zodat het zeker weggeschreven is
    // voordat de database dichtgaat
    await db.events
      .add({ at: Date.now(), type: 'dormant', instance: INSTANCE_ID, data: { by: event.data.id } })
      .catch(() => {});
    db.close();
  });
  document.addEventListener('visibilitychange', () => {
    // Opnieuw laden is de eenvoudigste manier om de database weer te openen
    // en de wachtrij te hervatten; bij het laden volgt een nieuwe claim.
    if (!document.hidden && instance.dormant) location.reload();
  });
}
