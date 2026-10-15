// Bouwstenen voor de tests: nepwaarnemingen en nepantwoorden van het model.
import { expect } from 'vitest';
import { crc32 } from './lib/xlsx';
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

/**
 * Nagebootste Web Locks (`navigator.locks`), genoeg voor de wachtrij:
 * wachten, afpakken (`steal`), opgeven (`signal`) en `query`. happy-dom heeft
 * ze niet.
 */
export class FakeLockManager {
  private holder?: { name: string; clientId: string; stolen: () => void };
  private waiting: { name: string; clientId: string; grant: () => void }[] = [];

  /** Een ander exemplaar dat het slot pakt en nooit meer loslaat (bevroren). */
  holdForever(name: string): void {
    this.request(name, {}, () => new Promise(() => {}), 'bevroren').catch(() => {});
  }

  request<T>(
    name: string,
    options: LockOptions,
    callback: () => Promise<T>,
    clientId = 'dit',
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const grant = () => {
        let current = true;
        this.holder = {
          name,
          clientId,
          stolen: () => {
            current = false;
            reject(new DOMException('Slot afgepakt', 'AbortError'));
          },
        };
        callback().then(
          (value) => {
            if (!current) return;
            this.holder = undefined;
            resolve(value);
            this.waiting.shift()?.grant();
          },
          (error) => {
            if (!current) return;
            this.holder = undefined;
            reject(error);
            this.waiting.shift()?.grant();
          },
        );
      };
      if (options.steal) {
        this.holder?.stolen();
        grant();
      } else if (!this.holder) {
        grant();
      } else {
        const entry = { name, clientId, grant };
        this.waiting.push(entry);
        options.signal?.addEventListener('abort', () => {
          if (!this.waiting.includes(entry)) return;
          this.waiting = this.waiting.filter((w) => w !== entry);
          reject(new DOMException('Opgegeven', 'AbortError'));
        });
      }
    });
  }

  async query(): Promise<LockManagerSnapshot> {
    const info = ({ name, clientId }: { name: string; clientId: string }) => ({
      name,
      clientId,
      mode: 'exclusive' as const,
    });
    return {
      held: this.holder ? [info(this.holder)] : [],
      pending: this.waiting.map(info),
    };
  }
}

/** Leest een zip zonder compressie terug: naam → tekst, en controleert de CRC */
export async function unzipStored(blob: Blob): Promise<Map<string, string>> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const files = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    expect(view.getUint16(at + 8, true)).toBe(0);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.slice(at + 30, at + 30 + nameLength));
    const data = bytes.slice(at + 30 + nameLength, at + 30 + nameLength + size);
    expect(crc32(data)).toBe(view.getUint32(at + 14, true));
    files.set(name, new TextDecoder().decode(data));
    at += 30 + nameLength + size;
  }
  // Daarna de centrale lijst, met evenveel bestanden
  expect(view.getUint32(at, true)).toBe(0x02014b50);
  expect(view.getUint16(bytes.length - 12, true)).toBe(files.size);
  return files;
}
