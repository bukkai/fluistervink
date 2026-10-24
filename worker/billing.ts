// De echte rekening van OpenAI en Anthropic, als controle op wat de proxy zelf
// telt (worker/usage.ts) en de prijstabel in src/lib/costs.ts. Elk met een
// eigen beheersleutel (OPENAI_ADMIN_KEY, ANTHROPIC_ADMIN_KEY), die alleen hier
// staat. Zonder sleutel slaat de proxy die aanbieder over.
//
// - OpenAI: Costs API, https://platform.openai.com/docs/api-reference/usage/costs
// - Anthropic: Cost API (Admin API), alleen met een organisatie, niet met een
//   persoonlijk account: https://platform.claude.com/docs/en/manage-claude/usage-cost-api
//
// Beide geven kosten per dag in UTC. De proxy bewaart het een uur in KV
// (TESTERS), zodat niet elk bezoek aan Developer de API's aanroept.

import type { Bill, Provider } from '../src/lib/costs';

export interface BillingKeys {
  OPENAI_ADMIN_KEY?: string;
  ANTHROPIC_ADMIN_KEY?: string;
}

/** Zo lang geldt een opgehaalde rekening. */
export const BILL_MAX_AGE = 60 * 60 * 1000;
/** Een maand heeft hooguit 31 dagen; meer pagina's is een fout. */
const MAX_PAGES = 3;

const kvKey = (provider: Provider) => `billing/${provider}`;

/**
 * De rekening van deze maand (UTC) per dag, uit KV of vers opgehaald. Null
 * zonder beheersleutel; bij een fout `{ error }`, die niet bewaard wordt.
 */
export async function bill(
  kv: KVNamespace,
  provider: Provider,
  key: string | undefined,
  now = new Date(),
): Promise<Bill | { error: string } | null> {
  if (!key) return null;
  const month = now.toISOString().slice(0, 7);
  const cached = await kv.get<Bill>(kvKey(provider), 'json');
  if (cached?.month === month && now.getTime() - cached.fetchedAt < BILL_MAX_AGE) return cached;
  try {
    const start = new Date(`${month}-01T00:00:00Z`);
    const days = await (provider === 'openai' ? openaiCosts : anthropicCosts)(key, start);
    const fresh: Bill = { month, days, fetchedAt: now.getTime() };
    await kv.put(kvKey(provider), JSON.stringify(fresh), { expirationTtl: BILL_MAX_AGE / 1000 });
    return fresh;
  } catch (error) {
    console.error({ billing: provider, error: String(error) });
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Fout van een aanbieder, met de melding uit het antwoord als die er is. */
async function upstreamError(name: string, response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } };
  return new Error(`${name} ${response.status}: ${body?.error?.message ?? response.statusText}`);
}

/** Dollars per dag (`2026-10-24`), OpenAI: bedragen in dollars. */
async function openaiCosts(key: string, start: Date): Promise<Record<string, number>> {
  const days: Record<string, number> = {};
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = new URL('https://api.openai.com/v1/organization/costs');
    url.searchParams.set('start_time', String(start.getTime() / 1000));
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '31');
    if (page) url.searchParams.set('page', page);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw await upstreamError('OpenAI', response);
    const result = (await response.json()) as {
      data: {
        start_time: number;
        results: { amount?: { value?: number; currency?: string } }[];
      }[];
      has_more: boolean;
      next_page: string | null;
    };
    for (const bucket of result.data) {
      const day = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
      for (const { amount } of bucket.results) {
        if (amount?.currency?.toLowerCase() !== 'usd') continue;
        days[day] = (days[day] ?? 0) + (amount.value ?? 0);
      }
    }
    if (!result.has_more || !result.next_page) return days;
    page = result.next_page;
  }
  throw new Error('OpenAI: te veel pagina’s');
}

/** Dollars per dag, Anthropic: bedragen in centen, als tekst. */
async function anthropicCosts(key: string, start: Date): Promise<Record<string, number>> {
  const days: Record<string, number> = {};
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = new URL('https://api.anthropic.com/v1/organizations/cost_report');
    url.searchParams.set('starting_at', start.toISOString());
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '31');
    if (page) url.searchParams.set('page', page);
    const response = await fetch(url, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (!response.ok) throw await upstreamError('Anthropic', response);
    const result = (await response.json()) as {
      data: { starting_at: string; results: { amount?: string; currency?: string }[] }[];
      has_more: boolean;
      next_page: string | null;
    };
    for (const bucket of result.data) {
      const day = bucket.starting_at.slice(0, 10);
      for (const { amount, currency } of bucket.results) {
        if (currency !== 'USD') continue;
        days[day] = (days[day] ?? 0) + Number(amount ?? 0) / 100;
      }
    }
    if (!result.has_more || !result.next_page) return days;
    page = result.next_page;
  }
  throw new Error('Anthropic: te veel pagina’s');
}
