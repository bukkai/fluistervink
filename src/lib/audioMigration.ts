import { t } from './i18n';
import { db, isStoredAudio, storeAudio, type Utterance } from './db';
import { logEvent } from './log';

// Opnames van vóór 28 okt staan nog als Blob in de database; iPhones konden die
// niet altijd teruglezen. De wachtrij zet ze bij de eerste ronde na het
// opstarten om naar bytes (`StoredAudio` in db.ts).

/** Hooguit één poging per start, en klaar is klaar per apparaat; de wachtrij wacht erop. */
export function migrateAudioOnce(): Promise<void> {
  return (audioMigration ??= migrateOnce());
}

/** In de log zoals de andere fouten van de wachtrij (`queue_error`). */
function migrateError(error: unknown, u: Utterance): void {
  const message = error instanceof Error ? error.message : String(error);
  logEvent(
    'queue_error',
    { step: 'migrate', message },
    { sessionId: u.sessionId, utteranceId: u.id },
  );
}

let audioMigration: Promise<void> | undefined;

/** Gezet als alle opnames bytes zijn; nieuwe opnames zijn dat altijd. */
const AUDIO_MIGRATED_KEY = 'fluistervink.audioMigrated';

/**
 * `migrateAudio` één keer per apparaat: daarna hoeft de app niet bij elke
 * start alle opnames te lezen. Mislukt het, dan loopt de wachtrij gewoon door
 * en probeert de volgende ronde het opnieuw.
 */
async function migrateOnce(): Promise<void> {
  // Opslag geblokkeerd: dan elke start opnieuw, maar wel migreren
  const storage = {
    done: () => {
      try {
        return !!localStorage.getItem(AUDIO_MIGRATED_KEY);
      } catch {
        return false;
      }
    },
    mark: () => {
      try {
        localStorage.setItem(AUDIO_MIGRATED_KEY, '1');
      } catch {
        // Dan de volgende start opnieuw kijken
      }
    },
  };
  try {
    if (storage.done()) return;
    if (await migrateAudio()) storage.mark();
  } catch (error) {
    audioMigration = undefined;
    logEvent('queue_error', {
      step: 'migrate',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Zet opnames die nog als Blob in de database staan om (zie `StoredAudio` in
 * db.ts), één keer per start. Is een Blob niet meer te lezen, dan gaat hij
 * eruit: zonder opname kan de uitspraak niet meer verwerkt worden, maar houdt
 * hij de rest van de wachtrij ook niet meer op. Geeft false als er een
 * opname niet weggeschreven kon worden (dan de volgende start opnieuw).
 */
export async function migrateAudio(): Promise<boolean> {
  let complete = true;
  const failed = (error: unknown, u: Utterance) => {
    migrateError(error, u);
    complete = false;
  };
  const ids = await db.utterances.filter((u) => !!u.audio && !isStoredAudio(u.audio)).primaryKeys();
  for (const id of ids) {
    const u = await db.utterances.get(id);
    if (!u?.audio || isStoredAudio(u.audio)) continue;
    let audio;
    try {
      audio = await storeAudio(u.audio);
    } catch (error) {
      migrateError(error, u);
      const waiting = u.transcript === undefined && u.status !== 'done';
      await db.utterances
        .update(id, {
          audio: undefined,
          ...(waiting && { status: 'failed', error: t('error.recordingUnreadable') }),
        })
        .catch((error) => failed(error, u));
      continue;
    }
    await db.utterances.update(id, { audio }).catch((error) => failed(error, u));
  }
  return complete;
}
