import { getTester } from './api';
import { db, type Utterance } from './db';
import { devNoteText } from './observations';

// Dev notes: bevindingen over de app, ingesproken tijdens het testen. Ze worden
// als uitspraak opgeslagen (kind `dev_note`) en kunnen als Markdown gekopieerd
// worden, met wat context erbij, om later te verwerken.

/** Zoveel eerdere uitspraken gaan als context mee in de export. */
const CONTEXT_SIZE = 3;

/** Alle dev notes, nieuwste eerst. */
export async function listDevNotes(): Promise<Utterance[]> {
  const all = await db.utterances.orderBy('recordedAt').reverse().toArray();
  return all.filter((u) => u.kind === 'dev_note');
}

/** De tekst van de note, zonder "dev note" ervoor. */
export function noteText(note: Utterance): string {
  return devNoteText(note.transcript ?? '') || (note.transcript ?? '');
}

export function mapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

const dateTimeFormat = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function resultLabel(u: Utterance): string {
  if (u.kind === 'dev_note') return 'dev note';
  if (u.undone) return 'teruggedraaid';
  if (u.status === 'failed') return `fout: ${u.error}`;
  if (u.status !== 'done') return 'nog niet verwerkt';
  const label = { saved: 'verwerkt', uncertain: 'onzeker', ignored: 'niet begrepen', note: '' }[
    u.result ?? 'saved'
  ];
  return u.error ? `${label}; ${u.error}` : label;
}

/** Alle dev notes als Markdown, met de uitspraken ervoor als context. */
export async function devNotesMarkdown(notes: Utterance[]): Promise<string> {
  const sections = await Promise.all(
    [...notes].reverse().map(async (note) => {
      const lines = [`## ${dateTimeFormat.format(note.recordedAt)}`, '', noteText(note), ''];

      if (note.position) {
        const { lat, lon, accuracy } = note.position;
        lines.push(
          `Locatie: [${lat.toFixed(5)}, ${lon.toFixed(5)}](${mapsUrl(lat, lon)}) (±${Math.round(accuracy)} m)`,
          '',
        );
      }

      const before = (
        await db.utterances.where('sessionId').equals(note.sessionId).sortBy('recordedAt')
      )
        .filter((u) => u.recordedAt < note.recordedAt)
        .slice(-CONTEXT_SIZE);
      if (before.length) {
        lines.push('Uitspraken ervoor:');
        for (const u of before) lines.push(`- "${u.transcript ?? "(opname, nog niet verstaan)"}" → ${resultLabel(u)}`);
        lines.push('');
      }
      return lines.join('\n');
    }),
  );
  const tester = getTester();
  const header = tester ? `Van: ${tester}\n\n` : '';
  return `# Dev notes Fluistervink\n\n${header}${sections.join('\n')}`;
}
