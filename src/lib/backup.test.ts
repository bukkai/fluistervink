import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';

// Back-up: dezelfde JSON-export, plus de datum van de laatste back-up en hoeveel
// sessies er sindsdien bij kwamen.

const saveFile = vi.fn();
vi.mock('./export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./export')>()),
  saveFile: (...args: unknown[]) => saveFile(...args),
}));

const { backupStatus, lastBackupAt, makeBackup } = await import('./backup');

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
    await makeBackup({ withAudio: false });
    expect(lastBackupAt()).toBeUndefined();

    saveFile.mockResolvedValueOnce({ folder: 'Downloads' });
    expect(await makeBackup({ withAudio: true })).toEqual({ folder: 'Downloads' });
    expect(lastBackupAt()).toBeGreaterThan(0);
    expect(saveFile.mock.calls[1][1]).toMatch(/^fluistervink-back-up-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('telt de sessies sinds de laatste back-up, met een lopende erbij', async () => {
    await addSession('oud', 100, 200);
    await addSession('nieuw', 400, 500);
    await addSession('loopt', 600);
    await db.utterances.add({
      id: 'u',
      sessionId: 'nieuw',
      recordedAt: 400,
      status: 'done',
      audio: { data: new ArrayBuffer(3000), type: 'audio/webm' },
    } as never);

    expect(await backupStatus(300)).toEqual({ sessions: 3, sinceBackup: 2, audioBytes: 3000 });
    expect(await backupStatus(undefined)).toMatchObject({ sinceBackup: 3 });
  });
});
