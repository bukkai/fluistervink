#!/usr/bin/env node
// Schermafbeeldingen voor Google Play (docs/play-store/README.md), met
// voorbeeldgegevens (seed.ts) in de stabiele versie (zonder label "beta").
//
//   npm run play-screenshots
//
// Start de dev-server in de stand van stable en een headless Chrome, die het
// script via het DevTools-protocol bestuurt: telefoonscherm 412×732 bij
// schaal 2,625 (1081×1922 px), GPS in de duinen, tijdzone zo dat het in de app
// ochtend is. De PNG's komen in docs/play-store/screenshots/. Vraagt Google
// Chrome in /Applications (net als de feature graphic) en internet voor de
// kaarttegels van OpenStreetMap.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const OUT = join(ROOT, 'docs/play-store/screenshots');
const PORT = 5199;
const DEBUG_PORT = 9333;
const BASE = `http://localhost:${PORT}/`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wacht tot een adres antwoordt */
async function waitFor(url, what) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // nog niet op
    }
    await sleep(300);
  }
  throw new Error(`${what} start niet`);
}

/** Tijdzone waarin het nu rond negen uur 's ochtends is (Etc/GMT-teken is omgekeerd) */
function morningZone(now = new Date()) {
  let offset = 9 - now.getUTCHours();
  if (offset > 14) offset -= 24;
  if (offset < -12) offset += 24;
  return offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
}

/** Eén verbinding met het DevTools-protocol */
function connect(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const waiting = new Map();
  const listeners = new Set();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message}`));
      else resolve(message.result);
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  });
  const opened = new Promise((resolve) => socket.addEventListener('open', resolve));
  return {
    opened,
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolve, reject) => waiting.set(messageId, { resolve, reject }));
    },
    once(method) {
      return new Promise((resolve) => {
        const listener = (message) => {
          if (message.method !== method) return;
          listeners.delete(listener);
          resolve(message.params);
        };
        listeners.add(listener);
      });
    },
    close: () => socket.close(),
  };
}

const vite = spawn('npx', ['vite', '--mode', 'stable', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: 'ignore',
});
const profile = mkdtempSync(join(tmpdir(), 'fluistervink-play-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  await waitFor(BASE, 'De dev-server');
  const version = await (
    await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/version`, 'Chrome')
  ).json();
  const browser = connect(version.webSocketDebuggerUrl);
  await browser.opened;
  await browser.send('Browser.grantPermissions', {
    origin: BASE.slice(0, -1),
    permissions: ['geolocation'],
  });

  const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const page = connect(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await page.opened;
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 732,
    deviceScaleFactor: 2.625,
    mobile: true,
  });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  });
  await page.send('Emulation.setTimezoneOverride', { timezoneId: morningZone() });
  // Laatste punt van de ochtend in seed.ts, bij de Amsterdamse Waterleidingduinen
  await page.send('Emulation.setGeolocationOverride', {
    latitude: 52.3487,
    longitude: 4.5961,
    accuracy: 6,
  });

  async function evaluate(expression) {
    const { result, exceptionDetails } = await page.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'Fout');
    return result.value;
  }

  /** Opent een scherm, altijd met een volledige laadbeurt (alleen de hash wisselen laadt niet) */
  async function open(hash) {
    for (const url of ['about:blank', BASE + hash]) {
      const loaded = page.once('Page.loadEventFired');
      await page.send('Page.navigate', { url });
      await loaded;
    }
    await sleep(2500);
  }

  async function shoot(name) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`  ${name}.png`);
  }

  /** Scrolt een kaart met deze titel net onder de kopbalk */
  async function scrollTo(heading) {
    await evaluate(`(() => {
      const h = [...document.querySelectorAll('main h2')].find((e) => e.textContent.includes(${JSON.stringify(heading)}));
      const card = h.closest('section');
      const header = document.querySelector('header').getBoundingClientRect().height;
      window.scrollTo(0, card.getBoundingClientRect().top + scrollY - header - 12);
    })()`);
    await sleep(1500);
  }

  mkdirSync(OUT, { recursive: true });

  // Eerst de gegevens: welkom en de vraag over delen al beantwoord
  await open('');
  const ids = await evaluate(`(async () => {
    localStorage.setItem('fluistervink.welcomeDone', '1');
    localStorage.setItem('fluistervink.share', 'false');
    const { seed } = await import('/scripts/play-screenshots/seed.ts');
    return seed();
  })()`);

  console.log(`Schermafbeeldingen in ${OUT.replace(ROOT, '')}:`);
  await open('');
  await shoot('1-inspreken');

  // De lopende sessie stoppen, zodat de vorige sessies te openen zijn
  await evaluate(`(async () => {
    const { db } = await import('/src/lib/db.ts');
    await db.sessions.update(${JSON.stringify(ids.active)}, { status: 'ended', endedAt: Date.now() - 60000 });
  })()`);
  await open(`#sessie/${ids.review}`);
  await shoot('2-samenvatting');
  await scrollTo('Onzeker nalopen');
  await shoot('3-nalopen');
  await open('#sessies');
  await shoot('4-export');
  // Het startscherm zonder lopende sessie
  await evaluate(`(async () => {
    const { db } = await import('/src/lib/db.ts');
    await db.sessions.delete(${JSON.stringify(ids.active)});
  })()`);
  await open('');
  await shoot('5-start');

  page.close();
  browser.close();
} finally {
  chrome.kill();
  vite.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
