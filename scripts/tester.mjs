#!/usr/bin/env node
// Testers beheren: maakt toegangscodes, houdt ze bij in .testers.json (niet in
// git) en zet ze als geheim ACCESS_CODES in Cloudflare. Zie "Testers
// uitnodigen" in de README.
//
//   npm run tester -- add anna       code maken, naar Cloudflare, link tonen
//   npm run tester -- remove anna    tester afsluiten
//   npm run tester -- list           testers met hun uitnodigingslink
//   npm run tester -- push           de lijst opnieuw naar Cloudflare sturen
//   npm run tester -- url <url>      adres van de app (voor de links)

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '.testers.json');

/** @returns {{ appUrl?: string, testers: Record<string, string> }} */
function load() {
  if (!existsSync(FILE)) return { testers: {} };
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}

/** 24 tekens, alleen letters, cijfers, - en _: veilig in een URL. */
function newCode() {
  return randomBytes(18).toString('base64url');
}

function link(data, code) {
  return `${(data.appUrl ?? '<app-url>').replace(/\/$/, '')}/#code=${code}`;
}

/** Zet de testers als geheim ACCESS_CODES in Cloudflare (via stdin, niet als argument). */
function push(data) {
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', 'ACCESS_CODES'], {
    input: JSON.stringify(data.testers),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (result.status !== 0) {
    console.error('\nNaar Cloudflare sturen mislukt. Ingelogd? Probeer `npx wrangler login`,');
    console.error('daarna `npm run tester -- push`. De lijst in .testers.json is wel bijgewerkt.');
    process.exit(1);
  }
}

function checkName(name) {
  if (!name || !/^[\p{L}\p{N}_-]+$/u.test(name)) {
    console.error('Geef een naam zonder spaties, bv. `npm run tester -- add anna`.');
    process.exit(1);
  }
}

const [command, arg] = process.argv.slice(2);
const data = load();

switch (command) {
  case 'add': {
    checkName(arg);
    if (arg === 'eigenaar') {
      console.error('"eigenaar" is gereserveerd voor ACCESS_CODE.');
      process.exit(1);
    }
    if (data.testers[arg]) {
      console.error(`${arg} bestaat al. Nieuwe code? Eerst \`npm run tester -- remove ${arg}\`.`);
      process.exit(1);
    }
    data.testers[arg] = newCode();
    save(data);
    push(data);
    console.log(`\n${arg} toegevoegd. Uitnodigingslink (op Android in Chrome openen):\n`);
    console.log(`  ${link(data, data.testers[arg])}\n`);
    if (!data.appUrl) console.log('Tip: `npm run tester -- url https://…` vult het adres in de link in.');
    break;
  }
  case 'remove': {
    checkName(arg);
    if (!data.testers[arg]) {
      console.error(`${arg} staat niet in de lijst.`);
      process.exit(1);
    }
    delete data.testers[arg];
    save(data);
    push(data);
    console.log(`\n${arg} afgesloten; de code werkt niet meer.`);
    break;
  }
  case 'list': {
    const names = Object.keys(data.testers);
    if (!names.length) console.log('Nog geen testers. `npm run tester -- add <naam>`');
    for (const name of names) console.log(`${name}\t${link(data, data.testers[name])}`);
    break;
  }
  case 'push':
    push(data);
    break;
  case 'url':
    if (!arg?.startsWith('https://')) {
      console.error('Geef het adres van de app, bv. `npm run tester -- url https://….workers.dev`.');
      process.exit(1);
    }
    data.appUrl = arg;
    save(data);
    console.log(`Adres opgeslagen: ${arg}`);
    break;
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(5, 10).join('\n').replace(/^\/\/ ?/gm, ''));
}
