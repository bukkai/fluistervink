import { db } from './db';

// Ruwe export van alle gegevens, als vangnet tijdens de ontwikkeling. Audio
// gaat niet mee (een Blob past niet in JSON); alleen de grootte.

export async function exportAllJson(): Promise<Blob> {
  const [sessions, utterances, observations] = await Promise.all([
    db.sessions.toArray(),
    db.utterances.toArray(),
    db.observations.toArray(),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    sessions,
    utterances: utterances.map(({ audio, ...u }) => ({ ...u, audioBytes: audio?.size })),
    observations,
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/** Laat de browser een bestand downloaden. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
