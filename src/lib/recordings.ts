import { LOCALE, t } from './i18n';
import { audioSize, db, type Utterance } from './db';
import { logEvent } from './log';
import { sharedAudioIds } from './share';

// Alleen de spraakopnames wissen, zonder de sessie: transcripten,
// waarnemingen en de rest blijven staan. Op verzoek van een tester ("kan ik
// de opnames makkelijk verwijderen?").
//
// Een uitspraak die nog in de wachtrij staat of verwerkt wordt, houdt zijn
// opname: zonder opname kan de spraakherkenning niets. Een mislukte uitspraak
// zonder transcript ook, want met de opname kan "Opnieuw" hem nog verwerken.
// Opnames die al met de ontwikkelaar gedeeld zijn, blijven op de proxy staan.

export interface RecordingCount {
  /** Opnames die gewist kunnen worden */
  count: number;
  bytes: number;
  /** Daarvan al gedeeld met de ontwikkelaar (blijven daar staan) */
  shared: number;
}

/** Mag de opname van deze uitspraak weg? */
function canDelete(u: Utterance): boolean {
  if (!u.audio) return false;
  if (u.status === 'pending' || u.status === 'processing') return false;
  return u.transcript !== undefined;
}

/**
 * Loopt de uitspraken met een opname die weg mag één voor één langs; zonder
 * `sessionId` van alle sessies. Niet alles tegelijk in het geheugen: dat
 * kunnen honderden opnames zijn, en de telling loopt opnieuw bij elke wijziging.
 */
async function eachDeletable(
  sessionId: string | undefined,
  visit: (u: Utterance) => void,
): Promise<void> {
  const utterances =
    sessionId === undefined
      ? db.utterances.toCollection()
      : db.utterances.where('sessionId').equals(sessionId);
  await utterances.each((u) => {
    if (canDelete(u)) visit(u);
  });
}

/** Hoeveel opnames er gewist kunnen worden (van één sessie of alles). */
export async function countRecordings(sessionId?: string): Promise<RecordingCount> {
  const sharedIds = sharedAudioIds();
  const result: RecordingCount = { count: 0, bytes: 0, shared: 0 };
  await eachDeletable(sessionId, (u) => {
    result.count++;
    result.bytes += audioSize(u.audio!);
    if (sharedIds.has(u.id)) result.shared++;
  });
  return result;
}

/**
 * Wist de opnames (van één sessie of alles) en geeft terug hoeveel. De
 * uitspraak houdt `audioDeletedAt`, zodat de review "opname gewist" kan tonen.
 */
export async function deleteRecordings(sessionId?: string, now = Date.now()): Promise<number> {
  const deleted = await db.transaction('rw', db.utterances, async () => {
    // In de transactie opnieuw kijken: de wachtrij kan intussen iets oppakken
    const ids: string[] = [];
    await eachDeletable(sessionId, (u) => ids.push(u.id));
    for (const id of ids) {
      await db.utterances.update(id, { audio: undefined, audioDeletedAt: now });
    }
    return ids.length;
  });
  logEvent('recordings_deleted', { count: deleted }, { sessionId });
  return deleted;
}

/** "3 opnames (1,2 MB)" */
export function describeRecordings({ count, bytes }: RecordingCount): string {
  const size =
    bytes >= 1_000_000
      ? `${(bytes / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(bytes / 1000))} kB`;
  return t('recordings.describe', { recordings: t('common.recordings', { n: count }), size });
}

/** Tekst voor de bevestiging vóór het wissen. */
export function confirmDeleteText(recordings: RecordingCount, scope: string): string {
  const { count, shared: n } = recordings;
  const shared = !n
    ? ''
    : n === count
      ? t('recordings.sharedAll', { n: count })
      : t('recordings.sharedSome', { n });
  const text = t('recordings.confirmDelete', { recordings: describeRecordings(recordings), scope });
  return shared ? `${text}\n\n${shared}` : text;
}
