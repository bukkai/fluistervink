#!/usr/bin/env node
// Haalt op wat testers met de app gedeeld hebben (zie src/lib/share.ts en
// /api/feedback in worker/index.ts) en zet het in testset/feedback/.
//
//   npm run feedback -- pull     nieuwe en gewijzigde wandelingen en opnames ophalen
//   npm run feedback -- notes    alle feedback als Markdown, nieuwste eerst
//   npm run feedback -- wipe <tester>   alles van een tester wissen, online en hier
//
// Na `pull` staat er per tester een export in testset/feedback/<tester>.json,
// in hetzelfde formaat als de JSON-export van de app (met de opnames die er
// zijn). Die kan zo door de testset: `npm run testset -- testset/feedback/anna.json`.
//
// Ophalen mag alleen met de toegangscode van de eigenaar (ACCESS_CODE in
// productie). Het script vraagt er één keer om en bewaart hem in .testers.json
// (niet in git). Adres: FLUISTERVINK_URL, anders `appUrl` uit .testers.json,
// anders productie.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, '.testers.json');
const OUT = join(ROOT, 'testset', 'feedback');
const MANIFEST = join(OUT, 'manifest.json');
const DEFAULT_URL = 'https://fluistervink.stephanmullernl.workers.dev';

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);

function writeJson(file, data, mode) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', mode ? { mode } : undefined);
}

async function ownerCode(config) {
  if (process.env.FLUISTERVINK_CODE) return process.env.FLUISTERVINK_CODE;
  if (config.ownerCode) return config.ownerCode;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question('Jouw toegangscode van productie (ACCESS_CODE): ')).trim();
  rl.close();
  if (!code) process.exit(1);
  return code;
}

/** Verzoeken aan /api/feedback met de code van de eigenaar. */
async function client() {
  const config = readJson(CONFIG, { testers: {} });
  const base = (process.env.FLUISTERVINK_URL ?? config.appUrl ?? DEFAULT_URL).replace(/\/$/, '');
  const code = await ownerCode(config);
  const api = async (path, init = {}) => {
    const response = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${code}` } });
    if (response.status === 401 || response.status === 403) {
      console.error('Toegangscode geweigerd: alleen de code van de eigenaar (ACCESS_CODE) mag ophalen.');
      process.exit(1);
    }
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  };
  return { config, code, api };
}

async function pull() {
  const { config, code, api } = await client();

  // Lijst van alles wat er is, met het moment van uploaden
  const keys = [];
  let cursor;
  do {
    const page = await (await api(`/api/feedback/list${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)).json();
    keys.push(...page.keys);
    cursor = page.cursor;
  } while (cursor);

  // De code werkt: bewaren voor de volgende keer
  if (!process.env.FLUISTERVINK_CODE && config.ownerCode !== code) {
    writeJson(CONFIG, { ...config, ownerCode: code }, 0o600);
  }

  const manifest = readJson(MANIFEST, {});
  let fetched = 0;
  for (const { key, uploadedAt } of keys) {
    if (manifest[key] === uploadedAt) continue;
    const data = Buffer.from(await (await api(`/api/feedback/file?key=${encodeURIComponent(key)}`)).arrayBuffer());
    const file = join(OUT, ...key.split('/')) + (key.includes('/sessions/') ? '.json' : '');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
    manifest[key] = uploadedAt;
    fetched++;
  }
  writeJson(MANIFEST, manifest);

  const testers = combine();
  console.log(`${fetched} nieuw of gewijzigd, ${keys.length} in totaal.`);
  for (const [tester, n] of Object.entries(testers)) {
    console.log(`  ${tester}: ${n.sessions} wandelingen, ${n.audio} opnames → testset/feedback/${tester}.json`);
  }
}

/** Per tester één export, in het formaat van de app (export.ts), met opnames. */
function combine() {
  const summary = {};
  if (!existsSync(OUT)) return summary;
  for (const tester of readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(OUT, tester.name);
    const sessionFiles = existsSync(join(dir, 'sessions')) ? readdirSync(join(dir, 'sessions')) : [];
    const audioDir = join(dir, 'audio');
    const audioIds = new Set(existsSync(audioDir) ? readdirSync(audioDir) : []);

    const merged = { exportedAt: new Date().toISOString(), tester: tester.name, sessions: [], utterances: [], observations: [], deletedObservations: [], events: [] };
    for (const file of sessionFiles) {
      const data = JSON.parse(readFileSync(join(dir, 'sessions', file), 'utf8'));
      merged.appVersion = data.appVersion;
      for (const field of ['sessions', 'observations', 'deletedObservations', 'events']) merged[field].push(...(data[field] ?? []));
      for (const u of data.utterances ?? []) {
        if (audioIds.has(u.id)) {
          const bytes = readFileSync(join(audioDir, u.id));
          u.audioData = `data:${u.audioType || 'audio/webm'};base64,${bytes.toString('base64')}`;
        }
        merged.utterances.push(u);
      }
    }
    writeJson(join(OUT, `${tester.name}.json`), merged);
    summary[tester.name] = { sessions: merged.sessions.length, audio: audioIds.size };
  }
  return summary;
}

function notes() {
  const items = [];
  if (existsSync(OUT)) {
    for (const file of readdirSync(OUT).filter((f) => f.endsWith('.json') && f !== 'manifest.json')) {
      const data = JSON.parse(readFileSync(join(OUT, file), 'utf8'));
      for (const u of data.utterances ?? []) {
        if (u.kind === 'dev_note') items.push({ tester: data.tester, at: u.recordedAt, text: u.transcript ?? '', appVersion: u.metrics?.appVersion });
      }
    }
  }
  if (!items.length) {
    console.log('Geen feedback gevonden. Eerst `npm run feedback -- pull`?');
    return;
  }
  const format = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
  console.log('# Feedback van testers\n');
  for (const item of items.sort((a, b) => b.at - a.at)) {
    console.log(`- **${item.tester}**, ${format.format(item.at)}: ${item.text}`);
  }
}

/**
 * Alles wat een tester gedeeld heeft wissen, in KV én in testset/feedback/
 * (de privacypagina belooft dat op verzoek). Exports die je zelf elders in
 * testset/ hebt gezet, blijven staan.
 */
async function wipe(tester) {
  if (!tester || !/^[\w-]+$/.test(tester)) {
    console.error('Gebruik: npm run feedback -- wipe <tester>');
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`Alles van "${tester}" definitief wissen? Typ de naam ter bevestiging: `)).trim();
  rl.close();
  if (answer !== tester) {
    console.log('Niets gewist.');
    return;
  }
  const { api } = await client();
  const { deleted } = await (await api(`/api/feedback/tester?name=${encodeURIComponent(tester)}`, { method: 'DELETE' })).json();

  rmSync(join(OUT, tester), { recursive: true, force: true });
  rmSync(join(OUT, `${tester}.json`), { force: true });
  const manifest = readJson(MANIFEST, {});
  for (const key of Object.keys(manifest)) if (key.startsWith(`${tester}/`)) delete manifest[key];
  if (existsSync(MANIFEST)) writeJson(MANIFEST, manifest);
  console.log(`${deleted} bestanden online gewist, en de kopie in testset/feedback/.`);
}

const command = process.argv[2];
if (command === 'pull') await pull();
else if (command === 'notes') notes();
else if (command === 'wipe') await wipe(process.argv[3]);
else console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(4, 7).join('\n').replace(/^\/\/ ?/gm, ''));
