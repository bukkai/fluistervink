import { audioSize, db, type Utterance } from './db';
import { logEvent } from './log';
import { sharedAudioIds } from './share';

// Alleen de spraakopnames wissen, zonder de wandeling: transcripten,
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
 * `sessionId` van alle wandelingen. Niet alles tegelijk in het geheugen: dat
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

/** Hoeveel opnames er gewist kunnen worden (van één wandeling of alles). */
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
 * Wist de opnames (van één wandeling of alles) en geeft terug hoeveel. De
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
      ? `${(bytes / 1_000_000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(bytes / 1000))} kB`;
  return `${count === 1 ? '1 opname' : `${count} opnames`} (${size})`;
}

/** Tekst voor de bevestiging vóór het wissen. */
export function confirmDeleteText(recordings: RecordingCount, scope: string): string {
  const { count, shared: n } = recordings;
  const who =
    n === count ? (count === 1 ? 'Die is' : 'Ze zijn') : n === 1 ? '1 ervan is' : `${n} ervan zijn`;
  const shared = n
    ? `\n\n${who} al gedeeld met de ontwikkelaar; daar blijft dat staan. Wil je dat ook weg, vraag het dan als feedback.`
    : '';
  return (
    `${describeRecordings(recordings)} ${scope} wissen? Wat je zei blijft als tekst staan, ` +
    `net als de waarnemingen. Terugluisteren kan daarna niet meer.${shared}`
  );
}
