import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askPermissions, setWelcomeDone, welcomeDone } from './welcome';

// Welkom voor nieuwelingen: alvast toestemming vragen, zonder op te nemen.

const stop = vi.fn();
const getUserMedia = vi.fn();
const getCurrentPosition = vi.fn();

beforeEach(() => {
  localStorage.clear();
  stop.mockReset();
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop }] });
  getCurrentPosition.mockReset().mockImplementation((ok: () => void) => ok());
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: { getUserMedia },
    geolocation: { getCurrentPosition },
  });
});

afterEach(() => vi.unstubAllGlobals());

const denied = (code: number) => (_ok: unknown, fail: (e: object) => void) =>
  fail({ code, PERMISSION_DENIED: 1 });

describe('welkom', () => {
  it('onthoudt dat het welkom is weggeklikt', () => {
    expect(welcomeDone()).toBe(false);
    setWelcomeDone();
    expect(welcomeDone()).toBe(true);
  });

  it('vraagt microfoon en locatie en zet de microfoon meteen weer uit', async () => {
    expect(await askPermissions()).toEqual({ microphone: true, location: true });
    expect(stop).toHaveBeenCalled();
  });

  it('meldt geweigerde toestemming', async () => {
    getUserMedia.mockRejectedValue(new Error('NotAllowedError'));
    getCurrentPosition.mockImplementation(denied(1));
    expect(await askPermissions()).toEqual({ microphone: false, location: false });
  });

  it('telt locatie als gegeven als alleen de meting mislukt', async () => {
    getCurrentPosition.mockImplementation(denied(3));
    expect(await askPermissions()).toMatchObject({ location: true });
  });
});
