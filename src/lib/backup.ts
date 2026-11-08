import { db, type Session, type Utterance } from './db';
import { exportAllJson, saveFile } from './export';
import { logEvent } from './log';
import type { SaveResult } from './native';

// Back-up voor de gebruiker: alles staat alleen op de telefoon, dus wie hem
// kwijtraakt of de app verwijdert, is niet-geëxporteerde sessies kwijt. De
// back-up is dezelfde JSON als de export op Developer, en terugzetten is
// `importJson`: alleen sessies en losse feedback die er nog niet zijn, er
// wordt niets overschreven.
//
// Opnames gaan alleen mee waar ze nog nodig zijn (`needsAudio`): na het
// nalopen zijn de waarnemingen het waardevolle deel, en opnames maken het
// bestand vele malen groter (in de app gaat het in één keer naar Android).

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
}

export async function backupStatus(since = lastBackupAt()): Promise<BackupStatus> {
  const sessions = await db.sessions.toArray();
  const sinceBackup =
    since === undefined
      ? sessions.length
      : sessions.filter((s) => (s.endedAt ?? Date.now()) > since).length;
  return { sessions: sessions.length, sinceBackup };
}

/**
 * Of de opname van een uitspraak mee moet in de back-up: als hij nog niet (goed)
 * verwerkt is, want dan kan alleen "Opnieuw" hem nog redden, of als de sessie
 * nog niet is nagelopen (klaargezet of geëxporteerd), want dan wil je bij het
 * nalopen kunnen terugluisteren. Losse feedback staat er al als tekst.
 */
export function needsAudio(u: Utterance, session: Session | undefined): boolean {
  if (u.status !== 'done') return true;
  return !!session && !session.readyAt && !session.exportedAt;
}

/** Bewaart alles als bestand (Downloads in de app, een download in de browser) */
export async function makeBackup(): Promise<SaveResult> {
  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 10);
  const sessions = new Map((await db.sessions.toArray()).map((s) => [s.id, s]));
  let recordings = 0;
  const withAudio = (u: Utterance) => {
    const include = !!u.audio && needsAudio(u, sessions.get(u.sessionId));
    if (include) recordings++;
    return include;
  };
  const saved = await saveFile(
    await exportAllJson({ withAudio }),
    `fluistervink-back-up-${date}.json`,
  );
  // Geannuleerd (Opslaan als-venster): geen back-up
  if (saved) {
    setLastBackupAt(now);
    logEvent('backup_saved', { recordings });
  }
  return saved;
}
