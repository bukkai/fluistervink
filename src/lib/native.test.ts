import { beforeEach, describe, expect, it, vi } from 'vitest';

// Een bestand opslaan in de Android-app (BestandPlugin.java). Een grote
// back-up gaat in stukken over de brug (ronde vóór productie, 25 nov); een app
// van vóór v0.8 kent dat niet en krijgt alles in één keer.

const bestand = vi.hoisted(() => ({
  opslaan: vi.fn(),
  begin: vi.fn(),
  stuk: vi.fn(),
  afbreken: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    isPluginAvailable: () => true,
  },
  registerPlugin: (name: string) => (name === 'Bestand' ? bestand : {}),
}));

const { SAVE_CHUNK_BYTES, saveFileNative } = await import('./native');

/** Wat er in het bestand op de telefoon komt: de stukken achter elkaar */
const written = () =>
  Buffer.concat(bestand.stuk.mock.calls.map(([{ data }]) => Buffer.from(data, 'base64')));

beforeEach(() => {
  vi.resetAllMocks();
  bestand.opslaan.mockResolvedValue({ opgeslagen: true, map: 'Downloads' });
  bestand.begin.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001' });
  bestand.stuk.mockResolvedValue(undefined);
  bestand.afbreken.mockResolvedValue(undefined);
});

describe('saveFileNative', () => {
  const bytes = new Uint8Array(SAVE_CHUNK_BYTES * 2 + 1000).map((_, i) => i % 256);
  const big = new Blob([bytes], { type: 'application/json' });

  it('een groot bestand in stukken, en die samen zijn precies het bestand', async () => {
    expect(await saveFileNative(big, 'back-up.json')).toEqual({ folder: 'Downloads' });
    expect(bestand.stuk).toHaveBeenCalledTimes(3);
    expect(new Uint8Array(written())).toEqual(bytes);
    expect(bestand.opslaan).toHaveBeenCalledWith({
      naam: 'back-up.json',
      type: 'application/json',
      id: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('een klein bestand (CSV) in één keer', async () => {
    await saveFileNative(new Blob(['a;b'], { type: 'text/csv;charset=utf-8' }), 'w.csv');
    expect(bestand.begin).not.toHaveBeenCalled();
    expect(bestand.opslaan).toHaveBeenCalledWith({ naam: 'w.csv', type: 'text/csv', data: 'YTti' });
  });

  it('een app van vóór v0.8 (geen begin): alles in één keer', async () => {
    bestand.begin.mockRejectedValue(new Error('not implemented'));
    await saveFileNative(big, 'back-up.json');
    expect(bestand.stuk).not.toHaveBeenCalled();
    const { data } = bestand.opslaan.mock.calls[0][0];
    expect(new Uint8Array(Buffer.from(data, 'base64'))).toEqual(bytes);
  });

  it('gaat een stuk mis, dan het tijdelijke bestand weg en de fout door', async () => {
    bestand.stuk.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('vol'));
    await expect(saveFileNative(big, 'back-up.json')).rejects.toThrow('vol');
    expect(bestand.afbreken).toHaveBeenCalledWith({ id: '00000000-0000-4000-8000-000000000001' });
    expect(bestand.opslaan).not.toHaveBeenCalled();
  });

  it('geannuleerd (Opslaan als-venster op oude Android): false', async () => {
    bestand.opslaan.mockResolvedValue({ opgeslagen: false });
    expect(await saveFileNative(big, 'back-up.json')).toBe(false);
  });
});
