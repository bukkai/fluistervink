import { describe, expect, it, vi } from 'vitest';
import { transcribe as transcribeAudio, type TranscribeOptions } from './api';
import { transcribe, transcribePromptVersionFor } from './transcribe';

// Wat de app naar de spraakherkenning stuurt (via de proxy), zonder echte
// aanroep: het verzoek zelf wordt nagebootst.
vi.mock('./api', () => ({
  transcribe: vi.fn(async () => ({
    data: { text: ' six Woodpigeons ', model: 'gpt-transcribe' },
    timing: { requestMs: 1 },
  })),
}));

const sent = () => vi.mocked(transcribeAudio).mock.calls.at(-1)![1] as TranscribeOptions;
const audio = new Blob(['x'], { type: 'audio/webm' });

describe('transcribe', () => {
  it('stuurt in het Nederlands de Nederlandse prompt, zonder taal (de proxy kiest nl)', async () => {
    await transcribe(audio);
    expect(sent().language).toBe('nl');
    expect(sent().prompt).toContain('Nee, keep in plaats van vink.');
    expect(sent().prompt).toContain('1kj');
  });

  it('stuurt in het Engels een Engelse prompt met Engelse namen en leeftijdscodes', async () => {
    const { text } = await transcribe(audio, { language: 'en', groups: true });
    expect(text).toBe('six Woodpigeons');
    const { language, prompt } = sent();
    expect(language).toBe('en');
    expect(prompt).toContain('No, Brambling instead of Chaffinch.');
    expect(prompt).toContain('Scratch that last one.');
    expect(prompt).toContain('Common Wood Pigeon');
    expect(prompt).toContain('1cy, 2cy');
    expect(prompt).toContain('Mammals:');
    expect(prompt).not.toContain('Houtduif');
  });

  it('heeft per taal een eigen promptversie', async () => {
    const versions = await Promise.all([
      transcribePromptVersionFor(false),
      transcribePromptVersionFor(true),
      transcribePromptVersionFor(false, 'en'),
      transcribePromptVersionFor(true, 'en'),
    ]);
    expect(new Set(versions).size).toBe(4);
  });
});
