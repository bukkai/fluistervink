#!/usr/bin/env node
// Zet de beta (main) door naar de stabiele versie op fluistervink.nl: branch
// `stable` gaat vooruit naar origin/main, Workers Builds deployt daarna. Zie
// docs/omgevingen.md.
//
//   npm run release            laat zien wat er meegaat en vraagt het eerst
//   npm run release -- --ja    zonder te vragen (behalve als de kwaliteitsronde te lang geleden is)
//
// Toont ook wanneer de laatste kwaliteitsronde was (docs/kwaliteitsronde.md).
// Na zes weken, of als er nog geen is vastgelegd, vraagt het altijd.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOGBOEK = join(ROOT, 'docs', 'kwaliteitsronde.md');
/** Na zoveel dagen zonder kwaliteitsronde altijd vragen. */
const MAX_DAGEN = 42;

function git(...args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr.trim() || `git ${args.join(' ')} mislukt`);
    process.exit(1);
  }
  return result.stdout.trim();
}

/** Bovenste regel van het logboek: `| 2026-10-24 | abc1234 | … |`. */
function laatsteRonde() {
  const match = readFileSync(LOGBOEK, 'utf8').match(
    /^\| (\d{4}-\d{2}-\d{2}) \| ([0-9a-f]{7,40}) \|/m,
  );
  return match ? { datum: match[1], commit: match[2] } : undefined;
}

async function vraag(tekst) {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const antwoord = (await rl.question(`${tekst} (j/N) `)).trim().toLowerCase();
  rl.close();
  return antwoord === 'j' || antwoord === 'ja';
}

git('fetch', '--quiet', 'origin', 'main', 'stable');

const nieuw = git('log', '--oneline', '--first-parent', 'origin/stable..origin/main');
if (!nieuw) {
  console.log('stable is al bij met main; niets te doen.');
  process.exit(0);
}
if (git('rev-list', '--count', 'origin/main..origin/stable') !== '0') {
  console.error(
    'stable heeft commits die niet op main staan. Eerst uitzoeken (docs/omgevingen.md).',
  );
  process.exit(1);
}

console.log('Dit gaat naar fluistervink.nl:\n');
console.log(nieuw.replace(/^/gm, '  '));
console.log();

const ronde = laatsteRonde();
let teLang = true;
if (!ronde) {
  console.log('Kwaliteitsronde: nog geen vastgelegd (docs/kwaliteitsronde.md).');
} else {
  const dagen = Math.floor((Date.now() - Date.parse(ronde.datum)) / 86_400_000);
  const sinds = spawnSync('git', ['rev-list', '--count', `${ronde.commit}..origin/main`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const commits = sinds.status === 0 ? `, ${sinds.stdout.trim()} commits op main sindsdien` : '';
  console.log(`Laatste kwaliteitsronde: ${ronde.datum} (${dagen} dagen geleden${commits}).`);
  teLang = dagen > MAX_DAGEN;
}

const ja = process.argv.includes('--ja');
if (teLang) {
  console.log(
    `Dat is langer dan ${MAX_DAGEN} dagen of nooit. Liever eerst een ronde op de beta, daarna releasen.`,
  );
  if (!(await vraag('Toch doorzetten naar stable?'))) process.exit(1);
} else if (!ja && !(await vraag('Doorzetten naar stable?'))) {
  process.exit(1);
}

git('push', 'origin', 'origin/main:refs/heads/stable');
console.log(
  '\nstable is bijgewerkt; Workers Builds deployt fluistervink.nl over een paar minuten.',
);
console.log('Nu is een goed moment voor een kwaliteitsronde op de beta: docs/kwaliteitsronde.md');
