import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';

// Back-up: dezelfde JSON-export, plus de datum van de laatste back-up en hoeveel
// sessies er sindsdien bij kwamen.

const saveFile = vi.fn();
vi.mock('./export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./export')>()),
  saveFile: (...args: unknown[]) => saveFile(...args),
}));

const { backupStatus, lastBackupAt, makeBackup, needsAudio } = await import('./backup');

beforeEach(() => {
  localStorage.clear();
  saveFile.mockReset();
});

async function addSession(id: string, startedAt: number, endedAt?: number) {
  await db.sessions.add({
    id,
    startedAt,
    endedAt,
    status: endedAt ? 'ended' : 'active',
  } as never);
}

describe('back-up', () => {
  it('onthoudt de datum alleen als het bestand is opgeslagen', async () => {
    saveFile.mockResolvedValueOnce(false);
    await makeBackup();
    expect(lastBackupAt()).toBeUndefined();

    saveFile.mockResolvedValueOnce({ folder: 'Downloads' });
    expect(await makeBackup()).toEqual({ folder: 'Downloads' });
    expect(lastBackupAt()).toBeGreaterThan(0);
    expect(saveFile.mock.calls[1][1]).toMatch(/^fluistervink-back-up-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('telt de sessies sinds de laatste back-up, met een lopende erbij', async () => {
    await addSession('oud', 100, 200);
    await addSession('nieuw', 400, 500);
    await addSession('loopt', 600);

    expect(await backupStatus(300)).toEqual({ sessions: 3, sinceBackup: 2 });
    expect(await backupStatus(undefined)).toMatchObject({ sinceBackup: 3 });
  });

  it('neemt alleen opnames mee die nog nodig zijn', async () => {
    const audio = { data: new Uint8Array([1, 2, 3]).buffer, type: 'audio/webm' };
    await db.sessions.bulkAdd([
      { id: 'open', startedAt: 1, endedAt: 2, status: 'ended' },
      { id: 'klaar', startedAt: 1, endedAt: 2, status: 'ended', readyAt: 3 },
    ]);
    await db.utterances.bulkAdd(
      [
        { id: 'open-done', sessionId: 'open', status: 'done' },
        { id: 'klaar-done', sessionId: 'klaar', status: 'done' },
        { id: 'klaar-failed', sessionId: 'klaar', status: 'failed' },
        { id: 'los', sessionId: '', status: 'done' },
      ].map((u) => ({ ...u, recordedAt: 1, audio }) as never),
    );
    saveFile.mockResolvedValueOnce({});
    await makeBackup();

    const blob: Blob = saveFile.mock.calls[0][0];
    const data = JSON.parse(await blob.text());
    const withAudio = data.utterances
      .filter((u: { audioData?: string }) => u.audioData)
      .map((u: { id: string }) => u.id)
      .sort();
    expect(withAudio).toEqual(['klaar-failed', 'open-done']);
  });

  it('needsAudio: geëxporteerde sessie zonder, mislukte uitspraak altijd', () => {
    const done = { status: 'done' } as never;
    expect(needsAudio(done, { exportedAt: 1 } as never)).toBe(false);
    expect(needsAudio({ status: 'pending' } as never, { exportedAt: 1 } as never)).toBe(true);
    expect(needsAudio(done, undefined)).toBe(false);
  });
});
