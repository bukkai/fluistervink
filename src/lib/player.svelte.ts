import { audioBlob, type StoredAudio } from './db';

/**
 * Speelt de opname van een uitspraak af, om te horen wat er gezegd werd. Eén
 * speler voor de hele app: er speelt hooguit één opname tegelijk, en nog eens
 * tikken op dezelfde pauzeert.
 */

/** De opname die nu geladen is */
let loaded: { id: string; audio: HTMLAudioElement; url: string } | undefined;
/** Uitspraak waarvan de opname nu speelt, voor ▶ of ⏸ op de knop */
let playingId = $state<string>();

// Met U+FE0E als tekst tonen, niet als gekleurde emoji (Android)
const PLAY = '▶︎';
const PAUSE = '⏸︎';

export const player = {
  /** Speelt de opname van deze uitspraak nu? */
  isPlaying(utteranceId: string | undefined): boolean {
    return utteranceId !== undefined && playingId === utteranceId;
  },

  /** Teken voor op de knop */
  symbol(utteranceId: string | undefined): string {
    return player.isPlaying(utteranceId) ? PAUSE : PLAY;
  },

  /** Tekst voor schermlezers bij de knop */
  label(utteranceId: string | undefined): string {
    return player.isPlaying(utteranceId) ? 'Opname pauzeren' : 'Opname afspelen';
  },

  /** Afspelen; nog eens tikken pauzeert, een andere opname stopt deze. */
  toggle(utteranceId: string, recording: StoredAudio | Blob): void {
    if (loaded?.id === utteranceId) {
      if (loaded.audio.paused) void loaded.audio.play();
      else loaded.audio.pause();
      return;
    }
    player.stop();
    const url = URL.createObjectURL(audioBlob(recording));
    const audio = new Audio(url);
    audio.onplay = () => (playingId = utteranceId);
    audio.onpause = () => {
      if (playingId === utteranceId) playingId = undefined;
    };
    // Afgelopen: volgende tik begint weer vooraan
    audio.onended = player.stop;
    loaded = { id: utteranceId, audio, url };
    void audio.play();
  },

  /** Stoppen en opruimen, bv. bij het verlaten van een scherm. */
  stop(): void {
    if (!loaded) return;
    loaded.audio.pause();
    URL.revokeObjectURL(loaded.url);
    loaded = undefined;
    playingId = undefined;
  },
};
