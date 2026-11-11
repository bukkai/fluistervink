import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTalkButton, HOLD_MS, REGRIP_MS, type RecorderStatus } from './talkButton';

// Nagebootste microfoon: start duurt `micMs`, finish zet hem meteen uit.
function setup(micMs = 100) {
  let status: RecorderStatus = 'idle';
  const finish = vi.fn(() => {
    status = 'idle';
  });
  const log = vi.fn();
  const talk = createTalkButton({
    status: () => status,
    start: () => {
      status = 'starting';
      return new Promise((resolve) =>
        setTimeout(() => {
          status = 'recording';
          resolve(true);
        }, micMs),
      );
    },
    finish,
    log,
  });
  return { talk, finish, log, status: () => status };
}

async function wait(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('opnameknop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tikken start, nog eens tikken stopt', async () => {
    const { talk, finish, status } = setup();
    talk.down();
    await wait(150);
    talk.up();
    expect(status()).toBe('recording');
    await wait(3000);
    talk.down();
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('vasthouden en loslaten stopt (na een korte wachttijd)', async () => {
    const { talk, finish } = setup();
    talk.down();
    await wait(2000);
    talk.up();
    expect(finish).not.toHaveBeenCalled();
    await wait(REGRIP_MS);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('een trage tik met handschoen (600 ms) is nog een tik', async () => {
    const { talk, finish, status } = setup(300);
    talk.down();
    await wait(600);
    talk.up();
    await wait(2000);
    expect(finish).not.toHaveBeenCalled();
    expect(status()).toBe('recording');
  });

  it('contact dat even wegvalt tijdens vasthouden stopt de opname niet', async () => {
    const { talk, finish, status, log } = setup();
    talk.down();
    await wait(1500);
    talk.up(); // handschoen verliest even contact
    await wait(120);
    talk.down();
    await wait(2000);
    expect(finish).not.toHaveBeenCalled();
    expect(status()).toBe('recording');
    expect(log).toHaveBeenCalledWith('talk_regrip', expect.objectContaining({ mode: 'hold' }));
    talk.up();
    await wait(REGRIP_MS);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('hapering vlak na een starttik stopt de opname niet', async () => {
    const { talk, finish, status } = setup();
    talk.down();
    await wait(150);
    talk.up();
    await wait(80);
    talk.down(); // dubbel contact
    await wait(50);
    talk.up();
    await wait(3000);
    expect(finish).not.toHaveBeenCalled();
    expect(status()).toBe('recording');
  });

  it('hapering vlak na een stoptik start geen nieuwe opname', async () => {
    const { talk, finish, status } = setup();
    talk.down();
    await wait(150);
    talk.up();
    await wait(3000);
    talk.down(); // stoppen
    await wait(100);
    talk.up();
    await wait(80);
    talk.down(); // dubbel contact
    await wait(50);
    talk.up();
    await wait(1000);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(status()).toBe('idle');
  });

  it('pointercancel tijdens vasthouden stopt zoals loslaten', async () => {
    const { talk, finish, log } = setup();
    talk.down();
    await wait(2000);
    talk.cancel();
    await wait(REGRIP_MS);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('talk_pointercancel', { status: 'recording' });
  });

  it('losgelaten terwijl de microfoon nog aangaat (toestemmingsvraag): blijft opnemen tot een tik', async () => {
    const { talk, finish, status } = setup(3000);
    talk.down();
    await wait(HOLD_MS + 500);
    talk.up();
    await wait(5000);
    // Vroeger stopte hij zodra hij liep: een lege opname (11 nov)
    expect(finish).not.toHaveBeenCalled();
    expect(status()).toBe('recording');
    talk.down();
    expect(finish).toHaveBeenCalledOnce();
  });

  it('vasthouden en loslaten nadat de microfoon aanging: stopt', async () => {
    const { talk, finish } = setup(1500);
    talk.down();
    await wait(2500);
    talk.up();
    await wait(REGRIP_MS);
    expect(finish).toHaveBeenCalledOnce();
  });

  it('drukken terwijl de microfoon aangaat doet niets', async () => {
    const { talk, finish, status } = setup(500);
    talk.down();
    await wait(100);
    talk.up();
    await wait(REGRIP_MS + 50);
    talk.down();
    await wait(50);
    talk.up();
    await wait(1000);
    expect(finish).not.toHaveBeenCalled();
    expect(status()).toBe('recording');
  });

  it('volumeknop: een druk start, een volgende stopt, ook als de microfoon traag is', async () => {
    const { talk, finish, status } = setup(1000);
    talk.tap();
    await wait(5000);
    expect(status()).toBe('recording');
    talk.tap();
    expect(finish).toHaveBeenCalledOnce();
    expect(status()).toBe('idle');
  });

  it('volumeknop: twee drukken vlak na elkaar tellen als één', async () => {
    const { talk, finish, status } = setup();
    talk.tap();
    await wait(100);
    talk.tap();
    await wait(2000);
    expect(status()).toBe('recording');
    expect(finish).not.toHaveBeenCalled();
  });
});
