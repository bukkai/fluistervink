// Gedrag van de opnameknop: tikken (nog eens tikken stopt) of vasthouden
// (loslaten stopt). Los van de component, zodat het te testen is.
//
// Met handschoenen is de aanraking minder zeker: een tik duurt langer, en het
// contact valt soms heel even weg terwijl de vinger nog op de knop ligt. Zo'n
// onderbreking mag de opname niet stoppen, en ook niet per ongeluk een nieuwe
// starten.

/** Langer ingedrukt dan dit = vasthouden (loslaten stopt); korter = tikken (nog eens tikken stopt). */
export const HOLD_MS = 700;
/** Komt de vinger binnen deze tijd na het loslaten terug, dan is het dezelfde aanraking. */
export const REGRIP_MS = 300;

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'denied' | 'unsupported';

export interface TalkButtonDeps {
  status: () => RecorderStatus;
  /** Start de opname; true als hij loopt. */
  start: () => Promise<boolean>;
  /** Stopt de opname en bewaart hem. */
  finish: () => void;
  log?: (type: string, data?: Record<string, unknown>) => void;
  now?: () => number;
}

export function createTalkButton({
  status,
  start,
  finish,
  log = () => {},
  now = Date.now,
}: TalkButtonDeps) {
  let pressedAt = 0;
  let lastUpAt = -Infinity;
  /** Hoe deze opname bediend wordt; bepaald bij het eerste loslaten. */
  let mode: 'tap' | 'hold' | undefined;
  /** Loslaten na vasthouden: stoppen, tenzij de vinger snel terugkomt. */
  let stopTimer: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    stopTimer = undefined;
    if (status() === 'recording') finish();
  }

  async function down() {
    const t = now();
    if (stopTimer !== undefined) {
      // Contact viel even weg tijdens het vasthouden: gewoon doorgaan
      clearTimeout(stopTimer);
      stopTimer = undefined;
      log('talk_regrip', { mode: 'hold', gapMs: t - lastUpAt });
      return;
    }
    if (t - lastUpAt < REGRIP_MS) {
      // Hapering vlak na een tik: niet stoppen en ook niet opnieuw starten
      log('talk_regrip', { mode: mode ?? 'idle', gapMs: t - lastUpAt });
      return;
    }
    const current = status();
    if (current === 'starting') return;
    if (current === 'recording') {
      finish();
      return;
    }
    pressedAt = t;
    mode = undefined;
    await start();
  }

  function up() {
    const t = now();
    lastUpAt = t;
    const current = status();
    if (current !== 'recording' && current !== 'starting') return;
    if (mode === 'tap') return;
    // Losgelaten voordat de microfoon aan was (een toestemmingsvraag, een
    // trage Bluetooth-microfoon): er kon nog niets gezegd zijn, dus geen
    // vasthouden maar een tik. Stoppen bij loslaten gaf een lege opname (11 nov).
    if (current === 'starting' || (mode === undefined && t - pressedAt < HOLD_MS)) {
      mode = 'tap';
      return;
    }
    mode = 'hold';
    clearTimeout(stopTimer);
    stopTimer = setTimeout(stop, REGRIP_MS);
  }

  /** De browser nam de aanraking over (systeemgebaar): behandelen als loslaten. */
  function cancel() {
    log('talk_pointercancel', { status: status() });
    up();
  }

  /**
   * Eén druk zonder vasthouden, zoals de volumeknop (volumeKey.ts): starten,
   * of stoppen als hij al loopt. Vlak na elkaar telt als één druk.
   */
  function tap() {
    const started = down();
    up();
    return started;
  }

  return { down, up, cancel, tap };
}
