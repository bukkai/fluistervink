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

/** Uitspraken met een opname die weg mag; zonder `sessionId` van alle wandelingen. */
async function deletable(sessionId?: string): Promise<Utterance[]> {
  const utterances =
    sessionId === undefined
      ? await db.utterances.toArray()
      : await db.utterances.where('sessionId').equals(sessionId).toArray();
  return utterances.filter(canDelete);
}

/** Hoeveel opnames er gewist kunnen worden (van één wandeling of alles). */
export async function countRecordings(sessionId?: string): Promise<RecordingCount> {
  const shared = sharedAudioIds();
  const list = await deletable(sessionId);
  return {
    count: list.length,
    bytes: list.reduce((sum, u) => sum + audioSize(u.audio!), 0),
    shared: list.filter((u) => shared.has(u.id)).length,
  };
}

/**
 * Wist de opnames (van één wandeling of alles) en geeft terug hoeveel. De
 * uitspraak houdt `audioDeletedAt`, zodat de review "opname gewist" kan tonen.
 */
export async function deleteRecordings(sessionId?: string, now = Date.now()): Promise<number> {
  const deleted = await db.transaction('rw', db.utterances, async () => {
    // In de transactie opnieuw kijken: de wachtrij kan intussen iets oppakken
    const ids = (await deletable(sessionId)).map((u) => u.id);
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
