import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HOUTDUIF, REE, toolResponse, VINK } from '../test-helpers';
import { ApiError, createMessage, transcribe } from './api';
import { tryErrorText, tryUtterance } from './tryout';

// "Probeer het eens": dezelfde spraakherkenning en hetzelfde model als in een
// sessie, met de uitkomst in gewone woorden, en zonder iets op te slaan.

vi.mock('./log', () => ({ logEvent: vi.fn() }));
vi.mock('./api', async (actual) => ({
  ...(await actual<typeof import('./api')>()),
  transcribe: vi.fn(),
  createMessage: vi.fn(),
}));

const audio = new Blob(['x'], { type: 'audio/webm' });
const timing = {} as never;

function heard(text: string) {
  vi.mocked(transcribe).mockResolvedValue({ data: { text, model: 'gpt-transcribe' }, timing });
}

function answer(...calls: Parameters<typeof toolResponse>) {
  vi.mocked(createMessage).mockResolvedValue({ data: toolResponse(...calls), timing });
}

beforeEach(() => {
  vi.mocked(transcribe).mockReset();
  vi.mocked(createMessage).mockReset();
});

describe('tryUtterance', () => {
  it('beschrijft de waarnemingen in gewone woorden', async () => {
    heard('Zes overvliegende houtduiven en een roepje vink.');
    answer(
      [
        'add_observation',
        { species_name: 'Houtduif', species_id: HOUTDUIF, count: 6, activity_id: 1 },
      ],
      ['add_observation', { species_name: 'Vink', species_id: VINK, count: 1, uncertain: true }],
    );
    const result = await tryUtterance(audio, false);
    expect(result.transcript).toBe('Zes overvliegende houtduiven en een roepje vink.');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].text).toMatch(/^6 × Houtduif, /);
    expect(result.lines[0].uncertain).toBe(false);
    expect(result.lines[1]).toMatchObject({ text: '1 × Vink', uncertain: true });
  });

  it('noemt de groep bij andere dieren en de kandidaten bij twijfel', async () => {
    heard('Een ree, en fitis of tjiftjaf.');
    answer(
      ['add_observation', { species_name: 'Ree', species_id: REE, count: 1 }],
      [
        'add_observation',
        {
          species_name: 'Tjiftjaf',
          species_id: 0,
          count: 1,
          candidate_species: ['Fitis', 'Tjiftjaf'],
        },
      ],
    );
    const { lines } = await tryUtterance(audio, true);
    expect(lines[0].text).toBe('1 × Ree (zoogdieren)');
    expect(lines.at(-1)).toMatchObject({ text: '1 × Fitis of Tjiftjaf', uncertain: true });
  });

  it('vraagt het model niets als er niets verstaan is', async () => {
    heard('');
    expect(await tryUtterance(audio, false)).toEqual({ transcript: '', lines: [] });
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('geeft geen regels als het model geen waarneming hoort', async () => {
    heard('Mooi weer vandaag.');
    answer();
    expect((await tryUtterance(audio, false)).lines).toEqual([]);
  });

  it('stuurt geen sessie mee', async () => {
    heard('Een vink.');
    answer(['add_observation', { species_name: 'Vink', species_id: VINK, count: 1 }]);
    await tryUtterance(audio, false);
    expect(vi.mocked(transcribe).mock.calls[0][1]?.sessionId).toBeUndefined();
    expect(vi.mocked(createMessage).mock.calls[0][1]).toBeUndefined();
  });
});

describe('tryErrorText', () => {
  it('legt het plafond per dag uit', () => {
    expect(tryErrorText(new ApiError('te veel', 429, 'audio_limit'))).toMatch(/maximum/);
    expect(tryErrorText(new ApiError('te veel', 429, 'message_limit'))).toMatch(/uitspraken/);
  });
});
