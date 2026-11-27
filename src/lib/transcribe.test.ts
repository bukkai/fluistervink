import { beforeAll, describe, expect, it, vi } from 'vitest';
import { transcribe as transcribeAudio, type TranscribeOptions } from './api';
import { stripPromptEcho, transcribe, transcribePromptVersionFor } from './transcribe';

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

describe('stripPromptEcho', () => {
  let prompt: string;
  let promptEn: string;
  beforeAll(async () => {
    await transcribe(audio);
    prompt = sent().prompt!;
    await transcribe(audio, { language: 'en' });
    promptEn = sent().prompt!;
  });

  const examples =
    'Fluistervink, zes overvliegende houtduiven. Roepje vink. Twee zingende tjiftjaffen. ' +
    'Nee, keep in plaats van vink. Nog drie erbij. Die laatste weg. Wielewaal, een lifer! ' +
    'Feedback: de knop reageert traag.';

  it('haalt de teruggegeven voorbeeldzinnen weg (27 nov 10:23)', () => {
    expect(stripPromptEcho(examples, prompt)).toEqual({ text: '', removed: 12 });
  });

  it('haalt een teruggegeven soortenlijst weg (27 nov 13:44)', () => {
    const list = prompt.split('Vogelnamen: ')[1].split('.')[0] + '.';
    expect(stripPromptEcho(list, prompt)).toEqual({ text: '', removed: expect.any(Number) });
    // Ook een stuk uit het midden van de lijst
    const middle =
      'Heggenmus, Ringmus, Huismus, Witte Kwikstaart, Boompieper, Graspieper, Keep, Vink.';
    expect(stripPromptEcho(middle, prompt)).toEqual({ text: '', removed: 8 });
  });

  it('laat echte spraak voor of na de teruggegeven prompt staan', () => {
    expect(stripPromptEcho(`Twee boerenzwaluwen. ${examples}`, prompt).text).toBe(
      'Twee boerenzwaluwen.',
    );
  });

  it('laat gewone uitspraken staan, ook een opsomming van soorten', () => {
    for (const text of [
      'Roepje vink.',
      'Nee, keep in plaats van vink. Nog drie erbij.',
      'Kauw, ekster, twee Turkse tortels en een koolmees.',
      // Zeven soorten zonder aantal, op de volgorde van de lijst: net te weinig
      'Heggenmus, Ringmus, Huismus, Witte Kwikstaart, Boompieper, Graspieper, Vink.',
      // Acht, maar niet op volgorde
      'Vink, keep, koolmees, pimpelmees, merel, roodborst, winterkoning, heggenmus.',
    ]) {
      expect(stripPromptEcho(text, prompt)).toEqual({ text, removed: 0 });
    }
  });

  it('werkt ook met de Engelse prompt', () => {
    const echo =
      'Fluistervink, six Woodpigeons flying over. Chaffinch calling. Two Chiffchaffs singing. ' +
      'No, Brambling instead of Chaffinch. Three more. Scratch that last one.';
    expect(stripPromptEcho(echo, promptEn)).toEqual({ text: '', removed: 8 });
  });
});
