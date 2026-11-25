// Waarschuwing aan de eigenaar als de proxy iets tegenhoudt voor iedereen
// (kwaliteitsronde 25 nov, vóór productie). Zonder dit staat het alleen in
// Workers Logs en ziet een gebruiker alleen dat zijn uitspraken wachten.
//
// Naar een webhook (geheim ALERT_WEBHOOK, in het formaat van Discord:
// { content }), één keer per dag per soort, over beide omgevingen samen. Er
// gaat alleen de soort en een paar getallen mee: geen installatie, geen plek,
// geen tekst van een gebruiker. Zonder ALERT_WEBHOOK alleen het log.

import { dayOf } from '../src/lib/costs';

export interface AlertEnv {
  TESTERS: KVNamespace;
  ALERT_WEBHOOK?: string;
  CHANNEL?: string;
}

/** Waarover de proxy waarschuwt; de sleutel voor één keer per dag */
export type AlertKind =
  | 'budget_bijna'
  | 'budget'
  | 'install_limit'
  | 'share_limit'
  | 'openai_sleutel'
  | 'anthropic_sleutel';

/** Hoe lang de KV-sleutel blijft: tot ruim na het eind van de dag */
const KEEP_SECONDS = 2 * 24 * 60 * 60;

/** Niet wachten op een webhook die hangt: het verzoek van de gebruiker wacht mee */
const TIMEOUT_MS = 3000;

/** Per KV (dus per test apart) wat deze instantie vandaag al stuurde */
const sentHere = new WeakMap<KVNamespace, Set<string>>();

/**
 * Logt `text` en stuurt hem, als dat vandaag voor `kind` nog niet gebeurde,
 * naar de webhook. Gooit nooit: een waarschuwing mag geen verzoek laten
 * mislukken.
 */
export async function alert(
  env: AlertEnv,
  kind: AlertKind,
  text: string,
  now = new Date(),
): Promise<void> {
  const key = `alert/${dayOf(now)}/${kind}`;
  let sent = sentHere.get(env.TESTERS);
  if (!sent) sentHere.set(env.TESTERS, (sent = new Set()));
  if (sent.has(key)) return;
  sent.add(key);
  console.error(`Waarschuwing: ${text}`);
  if (!env.ALERT_WEBHOOK) return;
  try {
    // Andere instanties: KV. Twee tegelijk kunnen allebei sturen (KV is niet
    // meteen overal gelijk); twee berichten is beter dan geen.
    if ((await env.TESTERS.get(key)) !== null) return;
    await env.TESTERS.put(key, String(now.getTime()), { expirationTtl: KEEP_SECONDS });
    const response = await fetch(env.ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `Fluistervink (${env.CHANNEL ?? '?'}): ${text}` }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) console.error('Waarschuwing niet verstuurd', response.status);
  } catch (error) {
    console.error('Waarschuwing niet verstuurd', error);
  }
}
