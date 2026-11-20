import type { PositionLookup } from './db';
import { devOptionOn } from './devOptions';
import { vibrationPattern } from './feedback';
import { currentPosition } from './location.svelte';
import { logEvent } from './log';
import {
  doneScreenOffRecording,
  listenScreenOff,
  pendingScreenOffRecordings,
  screenOffSupported,
  stopScreenOffRecording,
  type ScreenOffRecording,
} from './native';
import { submitRecording } from './queue';
import { MIN_DURATION_MS } from './recorder.svelte';
import { takeChunkLookup } from './trektelRecorder.svelte';

// Proef: opnemen met het scherm uit (docs/roadmap-android.md stap 3,
// ontwikkeloptie `schermUit`). Met het scherm uit start en stopt de
// volumeknop een opname in de service van de Android-app
// (WandelingService.java), en de hele sessie lang ook de knop op de oortjes
// of een Bluetooth-afstandsbediening, als die bij ons aankomt (`via` is dan
// `oortjes`; welke toets en een dubbele druk staan in `screen_off_mediaknop`,
// de pogingen om de knop te krijgen in `screen_off_knop_claim`). De service geeft de opname hier af, en vanaf dan gaat
// alles zoals bij de knop in de app: eerst bewaren in IndexedDB
// (submitRecording), dan verwerken. Het bestand op de telefoon gaat pas weg
// als het hier bewaard is.
//
// Gemeten (gebeurtenissen `screen_off_…` in het log): hoe lang het duurt van
// stoppen tot bewaren, en welk deel daarvan de overdracht naar de WebView is.
//
// Een trektelling in de service (trektelRecorder.svelte.ts) geeft haar
// stukken op dezelfde manier af, met `trektel: true`; die komen in de
// wachtrij als trektelstuk, met de positie van het begin van het stuk, en in
// het log als `trektel_stuk`.

/** Toestand voor het sessiescherm */
export const screenOff = $state<{
  /** Een opname van de service loopt sinds dit moment */
  startedAt?: number;
  /**
   * De service heeft het type microfoon: een opname met de knop in de app
   * mag dan doorlopen als het scherm op slot gaat (Android geeft de app op de
   * achtergrond anders alleen stilte)
   */
  ready?: boolean;
}>({});

/** Kan het, en staat de ontwikkeloptie aan? */
export function screenOffEnabled(): boolean {
  return screenOffSupported && devOptionOn('schermUit');
}

/** Al bewaard of bezig: niet nog eens (gebeurtenis én `wachtend` kunnen dezelfde geven) */
const handled = new Set<string>();

/** Opname waarvan de positie onbekend is: gemaakt toen de app dicht was */
const NO_POSITION: PositionLookup = {
  source: 'none',
  waitMs: 0,
  error: 'opname met het scherm uit, app was gesloten',
};

/** Trektelstuk waarvan de webcode het begin niet hoorde */
const NO_CHUNK_POSITION: PositionLookup = {
  source: 'none',
  waitMs: 0,
  error: 'trektelstuk van de service, begin niet gemeld',
};

function toBlob(recording: ScreenOffRecording): Blob {
  const binary = atob(recording.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: recording.type });
}

/**
 * Een opname van de service bewaren en in de wachtrij zetten.
 * @param lookup Positie, opgevraagd toen de service meldde dat hij begon
 */
export async function receiveScreenOffRecording(
  recording: ScreenOffRecording,
  lookup: Promise<PositionLookup> | undefined,
): Promise<void> {
  if (handled.has(recording.id)) return;
  handled.add(recording.id);
  const receivedAt = Date.now();
  const hidden = document.hidden;
  const context = { sessionId: recording.sessieId };
  const trektel = recording.trektel === true;
  // Een trektelstuk: de positie die bij het begin van het stuk is opgevraagd
  const position =
    lookup ??
    (trektel ? takeChunkLookup(recording.startedAt) : undefined) ??
    Promise.resolve(trektel ? NO_CHUNK_POSITION : NO_POSITION);
  try {
    const audio = toBlob(recording);
    await submitRecording(
      recording.sessieId,
      { audio, startedAt: recording.startedAt, durationMs: recording.durationMs },
      position,
      trektel ? { trektel: true } : {},
    );
    const savedAt = Date.now();
    await doneScreenOffRecording(recording.id);
    const since = (at?: number) => (at === undefined ? undefined : receivedAt - at);
    logEvent(
      trektel ? 'trektel_stuk' : 'screen_off_recording',
      {
        durationMs: recording.durationMs,
        bytes: audio.size,
        peak: recording.piek,
        start: recording.start,
        stop: recording.stop,
        // Trektelstuk: spraak en niveaus (zoals trektel_silence), en hoe lang het scherm uit was
        ...(trektel && {
          speechMs: recording.spraakMs,
          peakDb: recording.piekDb,
          floorDb: recording.achtergrondDb,
          screenOffMs: recording.schermUitMs,
        }),
        // Bestand afmaken in de service (encoder leeglopen, mp4 sluiten)
        finishMs:
          recording.klaarAt !== undefined && recording.gestoptAt !== undefined
            ? recording.klaarAt - recording.gestoptAt
            : undefined,
        // Van versturen in Java tot hier: de brug naar de WebView
        bridgeMs: since(recording.verstuurdAt),
        // Van stoppen (volumeknop) tot hier
        transferMs: since(recording.gestoptAt),
        // Bewaren in IndexedDB
        saveMs: savedAt - receivedAt,
        hidden,
        // Opgehaald met `wachtend` (de gebeurtenis kwam niet aan)
        pending: recording.verstuurdAt === undefined || undefined,
      },
      context,
    );
  } catch (error) {
    // Het bestand blijft op de telefoon; `wachtend` geeft hem later opnieuw
    handled.delete(recording.id);
    logEvent('screen_off_failed', { id: recording.id, message: String(error) }, context);
  }
}

/**
 * Proef (20 nov): de WebView blijft zich met het scherm uit in beeld melden
 * (ZichtbareWebView.java), zodat Chromium de pagina niet stilzet en stukken
 * meteen verwerkt worden, met tril. Meten: geen `page_frozen` meer, `hidden`
 * false bij `trektel_stuk` met het scherm uit, en de accu in
 * `trektel_native_end`; hoe vaak het nodig was in `screen_off_webview_zichtbaar`.
 * Kost het te veel accu, dan hier uitzetten (geen nieuwe app-versie nodig).
 */
export const KEEP_WEBVIEW_VISIBLE = true;

/**
 * Chromium zet een pagina die niet in beeld is na een minuut stil (Page
 * Lifecycle "freeze"), ook met de service en een vastgehouden Web Lock
 * (gemeten 18 nov: stilgezet 60 s na het vergrendelen, tot het ontgrendelen).
 * De stukken van de service wachten dan; bij het ontgrendelen komt alles
 * binnen. Hier alleen meten hoe vaak en hoe lang (`page_frozen`). Geeft een
 * functie terug die stopt met meten.
 */
export function watchPageFreeze(context: { sessionId: string }): () => void {
  // Meten: stilgezet en weer verder (Chromium vuurt `freeze` en `resume`)
  let frozenAt: number | undefined;
  const onFreeze = () => (frozenAt = Date.now());
  const onResume = () => {
    logEvent(
      'page_frozen',
      {
        frozenAt,
        frozenMs: frozenAt === undefined ? undefined : Date.now() - frozenAt,
        hidden: document.hidden,
      },
      context,
    );
    frozenAt = undefined;
  };
  document.addEventListener('freeze', onFreeze);
  document.addEventListener('resume', onResume);

  return () => {
    document.removeEventListener('freeze', onFreeze);
    document.removeEventListener('resume', onResume);
  };
}

/**
 * Zet opnemen met het scherm uit aan voor deze sessie. Geeft een functie
 * terug die het weer uitzet (sessie gestopt, trektelling, scherm verlaten).
 */
export function startScreenOff(
  sessionId: string,
  maxMs: number,
  onPress: (via: string) => void,
): () => void {
  if (!screenOffEnabled()) return () => {};
  const context = { sessionId };
  let lookup: Promise<PositionLookup> | undefined;

  const { done, stop } = listenScreenOff(
    {
      sessieId: sessionId,
      maxMs,
      minMs: MIN_DURATION_MS,
      trilStart: vibrationPattern('screenOffStart'),
      trilStop: vibrationPattern('screenOffStop'),
      zichtbaar: KEEP_WEBVIEW_VISIBLE,
    },
    {
      onStart: (startedAt, via) => {
        // Tijd en positie horen bij het begin van de opname
        lookup = currentPosition();
        screenOff.startedAt = startedAt;
        logEvent(
          'screen_off_started',
          { via, delayMs: Date.now() - startedAt, hidden: document.hidden },
          context,
        );
      },
      onRecording: (recording) => {
        // Een stuk van de trektelling: heeft zijn eigen positie
        if (recording.trektel) {
          receiveScreenOffRecording(recording, undefined);
          return;
        }
        screenOff.startedAt = undefined;
        const current = lookup;
        lookup = undefined;
        receiveScreenOffRecording(recording, current);
      },
      onPress: (via) => {
        logEvent('screen_off_press_web', { via, hidden: document.hidden }, context);
        onPress(via);
      },
      onLog: (type, data) => {
        if (type === 'weggegooid' || type === 'niet_gestart') screenOff.startedAt = undefined;
        // De service kreeg het type microfoon later (startte pas na het aanzetten)
        // Of de service startte pas na het aanzetten (`service draait niet`)
        if ((type === 'knop_aan' || type === 'service_klaar') && data.microfoon === true) {
          screenOff.ready = true;
        }
        logEvent(`screen_off_${type}`, data, context);
      },
    },
  );

  const stopWatching = watchPageFreeze(context);
  done.then((result) => {
    if (result.ok) screenOff.ready = true;
    logEvent('screen_off_on', { ...result, zichtbaar: KEEP_WEBVIEW_VISIBLE }, context);
  });
  // Wat de service maakte terwijl de app dicht was
  pendingScreenOffRecordings().then((recordings) =>
    recordings.forEach((recording) => receiveScreenOffRecording(recording, undefined)),
  );

  return () => {
    stopWatching();
    // Na het uitzetten: wat de service nog afmaakte (het laatste stuk van een
    // trektelling, een opname die liep) meteen ophalen, niet pas bij de
    // volgende sessie
    void stop()
      .then(() => pendingScreenOffRecordings())
      .then((recordings) =>
        recordings.forEach((recording) => receiveScreenOffRecording(recording, undefined)),
      );
    screenOff.startedAt = undefined;
    screenOff.ready = undefined;
  };
}

/** De knop in de app stopt een opname van de service (scherm weer aan) */
export function stopScreenOff(): Promise<void> {
  return stopScreenOffRecording();
}
