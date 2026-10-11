// Bouwstenen voor de tests: nepwaarnemingen en nepantwoorden van het model.
import type Anthropic from '@anthropic-ai/sdk';
import type { Observation } from './lib/db';

export const VINK = 193;
export const KEEP = 127;
export const HOUTDUIF = 120;
export const BOOMKLEVER = 70;
export const BOOMKRUIPER = 71;

/** Een waarneming met redelijke standaardwaarden; geef mee wat ertoe doet. */
export function observation(fields: Partial<Observation> = {}): Observation {
  return {
    id: crypto.randomUUID(),
    sessionId: 'wandeling',
    utteranceId: 'uitspraak',
    speciesId: VINK,
    count: 1,
    observedAt: Date.now(),
    createdAt: Date.now(),
    uncertain: false,
    status: 'draft',
    ...fields,
  };
}

/** Antwoord van het model met deze tool calls, zoals de API het teruggeeft. */
export function toolResponse(...calls: [name: string, input: object][]): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    stop_reason: 'tool_use',
    stop_sequence: null,
    content: calls.map(([name, input], i) => ({
      type: 'tool_use',
      id: `toolu_${i}`,
      name,
      input,
    })),
    usage: { input_tokens: 0, output_tokens: 0 },
  } as unknown as Anthropic.Message;
}
