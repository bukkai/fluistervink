import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { player } from './player.svelte';

// Nagebootste <audio>: houdt bij wat er speelt, zonder geluid.
class FakeAudio {
  static all: FakeAudio[] = [];
  paused = true;
  onplay?: () => void;
  onpause?: () => void;
  onended?: () => void;
  constructor(public src: string) {
    FakeAudio.all.push(this);
  }
  play() {
    this.paused = false;
    this.onplay?.();
    return Promise.resolve();
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.onpause?.();
  }
}

const recording = new Blob(['x'], { type: 'audio/webm' });
let revoked: string[] = [];

beforeEach(() => {
  FakeAudio.all = [];
  revoked = [];
  let n = 0;
  vi.stubGlobal('Audio', FakeAudio);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++n}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void revoked.push(url));
});

afterEach(() => {
  player.stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('player', () => {
  it('speelt af en pauzeert bij nog eens tikken, zonder opnieuw te laden', () => {
    player.toggle('a', recording);
    expect(player.isPlaying('a')).toBe(true);
    expect(player.label('a')).toBe('Opname pauzeren');

    player.toggle('a', recording);
    expect(player.isPlaying('a')).toBe(false);
    expect(player.label('a')).toBe('Opname afspelen');

    player.toggle('a', recording);
    expect(player.isPlaying('a')).toBe(true);
    expect(FakeAudio.all).toHaveLength(1);
  });

  it('stopt de vorige opname als een andere begint', () => {
    player.toggle('a', recording);
    player.toggle('b', recording);
    expect(FakeAudio.all[0].paused).toBe(true);
    expect(revoked).toEqual(['blob:1']);
    expect(player.isPlaying('a')).toBe(false);
    expect(player.isPlaying('b')).toBe(true);
  });

  it('ruimt op als de opname afgelopen is', () => {
    player.toggle('a', recording);
    FakeAudio.all[0].onended?.();
    expect(player.isPlaying('a')).toBe(false);
    expect(revoked).toEqual(['blob:1']);

    // Volgende tik begint weer vooraan
    player.toggle('a', recording);
    expect(FakeAudio.all).toHaveLength(2);
  });
});
