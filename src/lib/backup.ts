import { audioSize, db } from './db';
import { exportAllJson, saveFile } from './export';
import { logEvent } from './log';
import type { SaveResult } from './native';

// Back-up voor de gebruiker: alles staat alleen op de telefoon, dus wie hem
// kwijtraakt of de app verwijdert, is niet-geëxporteerde sessies kwijt. De
// back-up is dezelfde JSON als de export op Developer (met opnames als de
// gebruiker dat wil), en terugzetten is `importJson`: alleen sessies en losse
// feedback die er nog niet zijn, er wordt niets overschreven.

const LAST_BACKUP_KEY = 'fluistervink.lastBackupAt';

/** Tijdstip van de laatste back-up op dit apparaat, of undefined */
export function lastBackupAt(): number | undefined {
  try {
    const value = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function setLastBackupAt(at: number): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(at));
  } catch {
    // Geblokkeerde opslag: dan alleen geen datum, de back-up zelf staat er
  }
}

export interface BackupStatus {
  /** Sessies op dit apparaat */
  sessions: number;
  /** Sessies die na de laatste back-up begonnen of nog doorliepen */
  sinceBackup: number;
  /** Bytes aan opnames (de back-up wordt met opnames ongeveer 4/3 hiervan groter) */
  audioBytes: number;
}

export async function backupStatus(since = lastBackupAt()): Promise<BackupStatus> {
  const sessions = await db.sessions.toArray();
  let audioBytes = 0;
  // Eén voor één, zodat niet alle opnames tegelijk in het geheugen staan
  await db.utterances.each((u) => {
    if (u.audio) audioBytes += audioSize(u.audio);
  });
  const sinceBackup =
    since === undefined
      ? sessions.length
      : sessions.filter((s) => (s.endedAt ?? Date.now()) > since).length;
  return { sessions: sessions.length, sinceBackup, audioBytes };
}

/** Bewaart alles als bestand (Downloads in de app, een download in de browser) */
export async function makeBackup({ withAudio }: { withAudio: boolean }): Promise<SaveResult> {
  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 10);
  const saved = await saveFile(
    await exportAllJson({ withAudio }),
    `fluistervink-back-up-${date}.json`,
  );
  // Geannuleerd (Opslaan als-venster): geen back-up
  if (saved) {
    setLastBackupAt(now);
    logEvent('backup_saved', { withAudio });
  }
  return saved;
}
