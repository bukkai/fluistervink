#!/usr/bin/env node
// Testset (stap 7): haalt de uitspraken uit een JSON-export van de app opnieuw
// door spraakherkenning en model, en vergelijkt de uitkomst met de waarnemingen
// zoals ze na het nalopen zijn. Zo zijn prompts, modellen en STT-opties
// objectief te vergelijken.
//
//   npm run testset -- <export.json> [opties]
//
//   --stt <model>     opgeslagen (standaard: de transcripten van destijds),
//                     gpt-4o-transcribe, gpt-4o-mini-transcribe of whisper-1
//                     (vraagt een export "met opnames")
//   --model <model>   Claude-model (standaard dat van de app), of "origineel":
//                     de bewaarde antwoorden van destijds scoren, zonder API
//   --alleen <id>     één uitspraak (begin van de id is genoeg)
//   --max <n>         alleen de eerste n uitspraken
//   --parallel <n>    zoveel tegelijk (standaard 4)
//   --stil            alleen de samenvatting, niet elke fout
//
// Uitspraken met een onbruikbaar label (bv. van vóór een bewuste
// promptwijziging) kun je uitsluiten in testset/uitsluiten.txt: per regel het
// begin van de id, eventueel met # en een reden erachter.
//
// Het script start zelf een dev-server als proxy (met de sleutels uit
// .dev.vars) en gebruikt de code van de app (prompt, tools, validatie), dus
// het test altijd de versie van de huidige branch.
//
// Het juiste antwoord per uitspraak wordt afgeleid, niet met de hand gelabeld:
// - nieuwe waarnemingen: zoals ze nú zijn, met alle correcties (met de hand
//   of met de stem: "nee, keep" is meestal een verstaanfout). Met de hand
//   verwijderd = had er niet moeten komen; een dubbel ingesproken waarneming
//   telt dus als fout (ruis, maar voor elke variant dezelfde). Met de stem
//   verwijderd ("die mag weg, was toch iets anders") = was op dat moment goed;
//   de verwijderuitspraak is een eigen testgeval.
// - correcties ("nee, keep", "nog drie erbij", "die mag weg"): de waarneming
//   die destijds werd aangepast, met de waarden zoals ze nu zijn.
// - ongedaan maken en dev notes die het model herkende: zoals destijds.
// - genegeerde uitspraken: er hoort niets uit te komen (een dev note mag).
// Overgeslagen: dev notes met "dev note" ervoor (gaan niet naar het model),
// teruggedraaide en mislukte uitspraken.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    stt: { type: 'string', default: 'opgeslagen' },
    model: { type: 'string' },
    alleen: { type: 'string' },
    max: { type: 'string' },
    parallel: { type: 'string', default: '4' },
    stil: { type: 'boolean', default: false },
  },
});

if (positionals.length !== 1) {
  console.error(
    'Gebruik: npm run testset -- <export.json> [--stt …] [--model …] (zie scripts/testset.mjs)',
  );
  process.exit(1);
}

const FIELDS = [
  'speciesId',
  'count',
  'countingMethodId',
  'activityId',
  'methodId',
  'lifeStageId',
  'sex',
];
const SNAKE = {
  species_id: 'speciesId',
  count: 'count',
  counting_method_id: 'countingMethodId',
  activity_id: 'activityId',
  method_id: 'methodId',
  life_stage_id: 'lifeStageId',
  sex: 'sex',
};

// ---------------------------------------------------------------------------
// Code van de app laden, en een proxy starten

const replay = opts.model !== 'origineel' || opts.stt !== 'opgeslagen';

let proxy;
if (replay) {
  // Volledige configuratie: de Worker met /api, sleutels uit .dev.vars
  proxy = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { port: 5199, strictPort: false },
  });
  await proxy.listen();
  const base = proxy.resolvedUrls.local[0];
  const code = /^ACCESS_CODE\s*=\s*"?([^"\n]*)"?/m.exec(
    readFileSync(join(ROOT, '.dev.vars'), 'utf8'),
  )?.[1];
  if (!code) throw new Error('Geen ACCESS_CODE in .dev.vars');
  // api.ts leest de toegangscode uit localStorage en roept relatieve URL's aan
  globalThis.localStorage = { getItem: () => code.trim(), setItem() {} };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => realFetch(new URL(url, base), init);
}

// Alleen om modules te laden (zonder de Worker)
const loader = await createServer({
  root: ROOT,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
});
const { MODEL, interpret, parseResponse, promptVersion } =
  await loader.ssrLoadModule('/src/lib/interpret.ts');
const { transcribe } = await loader.ssrLoadModule('/src/lib/transcribe.ts');
const { devNoteText } = await loader.ssrLoadModule('/src/lib/devNotePrefix.ts');
const vocab = await loader.ssrLoadModule('/src/lib/vocab.ts');
const { DEFAULT_ACTIVITY, DEFAULT_METHOD, DEFAULT_COUNTING_METHOD } = vocab;

const model = opts.model === 'origineel' ? 'origineel' : (opts.model ?? MODEL);

// ---------------------------------------------------------------------------
// Testset opbouwen uit de export

const data = JSON.parse(readFileSync(positionals[0], 'utf8'));
const utterances = [...data.utterances].sort((a, b) => a.recordedAt - b.recordedAt);
const allObservations = [...data.observations, ...(data.deletedObservations ?? [])];
const obsById = new Map(allObservations.map((o) => [o.id, o]));
// Met de stem verwijderd, maar niet (meer) in de prullenbak (exports van vóór
// de prullenbak): de uitspraak bewaarde een kopie, voor `undo`
for (const u of utterances) {
  for (const c of u.changes ?? []) {
    if (c.type !== 'delete' || obsById.has(c.observation.id)) continue;
    const deletedAt = u.metrics?.finishedAt ?? u.savedAt ?? u.recordedAt;
    const obs = { ...c.observation, deletedBy: 'voice', deletedAt };
    allObservations.push(obs);
    obsById.set(obs.id, obs);
  }
}

const skipped = {};
const skip = (reason) => (skipped[reason] = (skipped[reason] ?? 0) + 1);

/** Tool calls van destijds, als { name, input } */
function originalCalls(u) {
  return (u.llmOutput?.content ?? []).filter((b) => b.type === 'tool_use');
}

/**
 * Een waarneming zoals hij was vlak vóór uitspraak `u`: latere correcties met
 * de stem teruggedraaid (die bewaren de oude waarden). Correcties met de hand
 * zijn niet terug te draaien; die blijven staan.
 */
function stateBefore(obs, u) {
  const state = { ...obs };
  const later = utterances.filter((v) => v.recordedAt >= u.recordedAt && !v.undone).reverse();
  for (const v of later) {
    for (const c of v.changes ?? []) {
      if (c.type === 'update' && c.observationId === obs.id) Object.assign(state, c.before);
    }
  }
  return state;
}

/**
 * Welke waarnemingen het model destijds als context kreeg (#1 eerst), zoals
 * ze toen waren. Sinds deze versie bewaard; voor oudere uitspraken nagebouwd:
 * wat er toen bestond, op dezelfde volgorde als de app (`listObservations`).
 */
function contextFor(u) {
  const at = u.metrics?.startedAt ?? u.savedAt ?? u.recordedAt + (u.audioDurationMs ?? 0);
  const list = u.metrics?.contextIds
    ? u.metrics.contextIds.map((id) => obsById.get(id)).filter(Boolean)
    : allObservations
        .filter((o) => o.sessionId === u.sessionId && o.createdAt < at && !(o.deletedAt < at))
        .sort((a, b) => b.observedAt - a.observedAt || b.createdAt - a.createdAt)
        .slice(0, 10);
  return list.map((o) => stateBefore(o, u));
}

function expectedFor(u) {
  const calls = originalCalls(u);
  const changes = u.changes ?? [];
  const adds = changes
    .filter((c) => c.type === 'add')
    .map((c) => obsById.get(c.observationId))
    .filter((o) => o && o.deletedBy !== 'hand');
  // Welke velden de correctie wijzigde: uit `before`, aangevuld met de tool
  // call (een veld dat eerst leeg was, staat niet in de JSON van `before`)
  const calledFields = new Set(
    calls
      .filter((c) => c.name === 'update_observation')
      .flatMap((c) => Object.entries(c.input))
      .filter(([key, value]) => SNAKE[key] && value !== null && value !== undefined)
      .map(([key]) => SNAKE[key]),
  );
  const updates = changes
    .filter((c) => c.type === 'update')
    .map((c) => {
      const now = obsById.get(c.observationId);
      const fields = FIELDS.filter((f) => f in c.before || calledFields.has(f));
      return {
        id: c.observationId,
        before: c.before,
        // Inmiddels verwijderd: alleen nagaan of de goede waarneming bedoeld werd
        values: now && !now.deletedBy ? Object.fromEntries(fields.map((f) => [f, now[f]])) : {},
      };
    });
  const deletes = changes.filter((c) => c.type === 'delete').map((c) => c.observation.id);
  return {
    adds,
    updates,
    deletes,
    undo: calls.some((c) => c.name === 'undo'),
    devNote: calls.some((c) => c.name === 'add_dev_note'),
  };
}

const excludeFile = join(ROOT, 'testset', 'uitsluiten.txt');
const excluded = existsSync(excludeFile)
  ? readFileSync(excludeFile, 'utf8')
      .split('\n')
      .map((line) => line.replace(/#.*/, '').trim())
      .filter(Boolean)
  : [];

let items = [];
for (const u of utterances) {
  if (excluded.some((prefix) => u.id.startsWith(prefix))) skip('uitgesloten');
  else if (u.transcript === undefined) skip('nog niet verstaan');
  else if (u.status !== 'done') skip('mislukt of niet verwerkt');
  else if (u.undone) skip('ongedaan gemaakt');
  else if (devNoteText(u.transcript) !== undefined) skip('dev note ("dev note …")');
  else if (!u.transcript.trim()) skip('niets verstaan');
  else if (!u.llmOutput) skip('geen antwoord van het model bewaard');
  else items.push({ u, expected: expectedFor(u), context: contextFor(u) });
}

if (opts.alleen) items = items.filter((it) => it.u.id.startsWith(opts.alleen));
if (opts.max) items = items.slice(0, Number(opts.max));
if (opts.stt !== 'opgeslagen') {
  const without = items.filter((it) => !it.u.audioData).length;
  if (without) {
    for (let i = 0; i < without; i++) skip('geen opname in de export');
    items = items.filter((it) => it.u.audioData);
  }
}

function kindOf(expected) {
  if (expected.devNote) return 'dev note (herkend door model)';
  const correction = expected.updates.length || expected.deletes.length || expected.undo;
  if (correction && expected.adds.length) return 'gemengd';
  if (correction) return 'correctie';
  if (expected.adds.length) return 'waarneming';
  return 'niets (genegeerd)';
}

// ---------------------------------------------------------------------------
// Uitvoeren

function fromDataUrl(url) {
  const [head, base64] = url.split(',');
  return new Blob([Buffer.from(base64, 'base64')], {
    type: head.replace(/^data:/, '').replace(/;base64$/, ''),
  });
}

async function run(item) {
  const { u, context } = item;
  const result = { transcript: u.transcript };
  if (opts.stt !== 'opgeslagen') {
    const { text, timing } = await transcribe(fromDataUrl(u.audioData), opts.stt);
    result.transcript = text;
    result.sttMs = timing.requestMs;
    if (devNoteText(text) !== undefined) return { ...result, actions: [{ type: 'dev_note' }] };
    if (!text) return { ...result, actions: [] };
  }
  if (model === 'origineel') {
    return { ...result, ...parseResponse(u.llmOutput, context) };
  }
  // Stond de context van destijds erbij, dan precies die; anders nagebouwd
  const contextText = u.metrics?.contextIds ? u.metrics.context : undefined;
  const r = await interpret(result.transcript, context, { model, contextText });
  return {
    ...result,
    actions: r.actions,
    rejected: r.rejected,
    warnings: r.warnings,
    llmMs: r.timing.requestMs,
    usage: r.response.usage,
  };
}

// ---------------------------------------------------------------------------
// Vergelijken

/** Leeg en standaard gelijkstellen, zoals de app ze invult */
function norm(field, value) {
  if (value === null || value === undefined || value === 'unknown') {
    return {
      countingMethodId: DEFAULT_COUNTING_METHOD,
      activityId: DEFAULT_ACTIVITY,
      methodId: DEFAULT_METHOD,
    }[field];
  }
  if (field === 'lifeStageId' && value === 1) return undefined; // 1 = onbekend
  return value;
}

const same = (field, a, b) => norm(field, a) === norm(field, b);

/** @param context De waarnemingen zoals ze vlak vóór de uitspraak waren */
function compare(expected, got, context) {
  // Een aangepaste of verwijderde waarneming tonen zoals hij toen was
  const then = new Map(context.map((o) => [o.id, o]));
  const target = (id) => describe(then.get(id) ?? obsById.get(id));
  const diffs = [];
  const fieldStats = [];
  const gotAdds = got.actions.filter((a) => a.type === 'add').map((a) => a.fields);
  const left = [...gotAdds];

  // Eerst een exacte soort met hetzelfde geslacht en kleed, dan alleen de soort
  const pairs = [];
  const unmatched = [];
  for (const e of expected.adds) {
    const i = left.findIndex(
      (g) =>
        g.speciesId === e.speciesId &&
        same('sex', g.sex, e.sex) &&
        same('lifeStageId', g.lifeStageId, e.lifeStageId),
    );
    const j = i >= 0 ? i : left.findIndex((g) => g.speciesId === e.speciesId);
    if (j >= 0) pairs.push([e, left.splice(j, 1)[0]]);
    else unmatched.push(e);
  }
  for (const e of unmatched) diffs.push(`gemist: ${describe(e)}`);
  for (const g of left) diffs.push(`extra: ${describe(g)}`);
  for (const [e, g] of pairs) {
    for (const f of FIELDS.slice(1)) {
      const ok = same(f, e[f], g[f]);
      fieldStats.push([f, ok]);
      if (!ok)
        diffs.push(
          `${speciesName(e.speciesId)}: ${label(f)} ${show(f, g[f])}, moet ${show(f, e[f])}`,
        );
    }
  }

  const gotUpdates = got.actions.filter((a) => a.type === 'update');
  const gotDeletes = got.actions.filter((a) => a.type === 'delete').map((a) => a.observationId);
  for (const e of expected.updates) {
    const g = gotUpdates.find((a) => a.observationId === e.id);
    if (!g) {
      diffs.push(`correctie gemist op ${target(e.id)}`);
      continue;
    }
    gotUpdates.splice(gotUpdates.indexOf(g), 1);
    for (const [f, value] of Object.entries(e.values)) {
      // Niet meegegeven = blijft zoals het was
      const result =
        f === 'count' && g.addCount
          ? Math.max(1, (g.fields.count ?? e.before.count) + g.addCount)
          : (g.fields[f] ?? e.before[f]);
      if (!same(f, result, value))
        diffs.push(`correctie: ${label(f)} ${show(f, result)}, moet ${show(f, value)}`);
    }
  }
  for (const g of gotUpdates) diffs.push(`extra correctie op ${target(g.observationId)}`);
  for (const id of expected.deletes) {
    if (gotDeletes.includes(id)) gotDeletes.splice(gotDeletes.indexOf(id), 1);
    else diffs.push(`verwijderen gemist: ${target(id)}`);
  }
  for (const id of gotDeletes) diffs.push(`extra verwijderd: ${target(id)}`);

  const gotUndo = got.actions.some((a) => a.type === 'undo');
  if (expected.undo !== gotUndo)
    diffs.push(expected.undo ? 'ongedaan maken gemist' : 'onterecht ongedaan gemaakt');
  // Een dev note waar niets verwacht werd, is geen fout: er komt geen
  // waarneming bij (oudere versies van de app kenden geen dev notes van het model)
  const gotNote = got.actions.some((a) => a.type === 'dev_note');
  if (expected.devNote && !gotNote) diffs.push('dev note gemist');
  const nothingExpected =
    !expected.adds.length && !expected.updates.length && !expected.deletes.length && !expected.undo;
  if (gotNote && !expected.devNote && !nothingExpected) diffs.push('onterecht als dev note');
  for (const r of got.rejected ?? []) diffs.push(`afgewezen: ${r}`);

  return {
    ok: diffs.length === 0,
    diffs,
    fieldStats,
    species: { expected: expected.adds.length, found: pairs.length, extra: left.length },
    uncertain: gotAdds.filter((g) => g.uncertain).length,
  };
}

const speciesName = (id) => vocab.getSpecies(id)?.name ?? `soort ${id}`;
const label = (f) =>
  ({
    count: 'aantal',
    countingMethodId: 'telmethode',
    activityId: 'gedrag',
    methodId: 'methode',
    lifeStageId: 'kleed',
    sex: 'geslacht',
    speciesId: 'soort',
  })[f];

function show(f, value) {
  const v = norm(f, value);
  if (v === undefined) return '—';
  const lists = {
    countingMethodId: vocab.countingMethods,
    activityId: vocab.allActivities,
    methodId: vocab.allMethods,
    lifeStageId: vocab.allLifeStages,
  };
  if (f === 'speciesId') return speciesName(v);
  if (f === 'sex') return v === 'male' ? 'man' : 'vrouw';
  return lists[f] ? (vocab.codeName(lists[f], v) ?? String(v)) : String(v);
}

function describe(o) {
  if (!o) return '(onbekende waarneming)';
  const extra = ['activityId', 'methodId', 'lifeStageId', 'sex']
    .filter((f) => norm(f, o[f]) !== norm(f, undefined))
    .map((f) => show(f, o[f]));
  return `${o.count}× ${speciesName(o.speciesId)}${extra.length ? ` (${extra.join(', ')})` : ''}`;
}

// ---------------------------------------------------------------------------

async function pool(list, size, fn) {
  const results = new Array(list.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        try {
          results[i] = await fn(list[i]);
        } catch (error) {
          results[i] = { error: error instanceof Error ? error.message : String(error) };
        }
        process.stderr.write(`\r${++done}/${list.length}`);
      }
    }),
  );
  process.stderr.write('\r');
  return results;
}

const started = Date.now();
const outputs = await pool(items, Number(opts.parallel), run);
const results = items.map((item, i) => {
  const got = outputs[i];
  const base = { id: item.u.id, kind: kindOf(item.expected), original: item.u.transcript, ...got };
  if (got.error)
    return {
      ...base,
      ok: false,
      diffs: [`fout: ${got.error}`],
      fieldStats: [],
      species: { expected: 0, found: 0, extra: 0 },
    };
  return { ...base, ...compare(item.expected, got, item.context) };
});

await loader.close();
await proxy?.close();

// ---------------------------------------------------------------------------
// Verslag

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const line = (name, a, b) =>
  console.log(
    `  ${name.padEnd(30)} ${String(a).padStart(3)} / ${String(b).padEnd(4)} ${pct(a, b)}`,
  );
const median = (xs) => {
  const s = xs.filter((x) => x !== undefined).sort((a, b) => a - b);
  return s.length ? `${(s[Math.floor(s.length / 2)] / 1000).toFixed(1)} s` : '–';
};

const version = await promptVersion;
console.log(`\nTestset: ${positionals[0]}`);
console.log(`Spraak: ${opts.stt} · model: ${model} · prompt ${version}`);
console.log(
  `Overgeslagen: ${
    Object.entries(skipped)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ') || 'niets'
  }\n`,
);

const ok = results.filter((r) => r.ok).length;
line('Helemaal goed', ok, results.length);
for (const kind of [...new Set(results.map((r) => r.kind))].sort()) {
  const of = results.filter((r) => r.kind === kind);
  line(`  ${kind}`, of.filter((r) => r.ok).length, of.length);
}
const sp = results.reduce(
  (s, r) => ({ e: s.e + r.species.expected, f: s.f + r.species.found, x: s.x + r.species.extra }),
  { e: 0, f: 0, x: 0 },
);
console.log('');
line('Soorten gevonden', sp.f, sp.e);
console.log(`  ${'Soorten extra'.padEnd(30)} ${String(sp.x).padStart(3)}`);
console.log(
  `  ${'Soort-ID hersteld via naam'.padEnd(30)} ${String(results.reduce((s, r) => s + (r.warnings?.length ?? 0), 0)).padStart(3)}`,
);
console.log(
  `  ${'Onzeker gemarkeerd'.padEnd(30)} ${String(results.reduce((s, r) => s + (r.uncertain ?? 0), 0)).padStart(3)}`,
);
console.log('\nVelden bij de goede soort:');
for (const f of FIELDS.slice(1)) {
  const stats = results.flatMap((r) => r.fieldStats).filter(([name]) => name === f);
  line(`  ${label(f)}`, stats.filter(([, good]) => good).length, stats.length);
}
if (replay) {
  console.log(
    `\nTijd: model ${median(results.map((r) => r.llmMs))} (mediaan)` +
      (opts.stt !== 'opgeslagen' ? `, spraak ${median(results.map((r) => r.sttMs))}` : ''),
  );
}

if (!opts.stil) {
  const fixed = results.filter((r) => r.warnings?.length);
  if (fixed.length) console.log(`\nHersteld door de app (${fixed.length}):`);
  for (const r of fixed)
    console.log(`  "${r.transcript}"\n${r.warnings.map((w) => `    - ${w}`).join('\n')}`);
  const wrong = results.filter((r) => !r.ok);
  if (wrong.length) console.log(`\nFout (${wrong.length}):`);
  for (const r of wrong) {
    const changed = r.transcript !== r.original ? `\n    (destijds: "${r.original}")` : '';
    console.log(`\n  "${r.transcript}"  [${r.id.slice(0, 8)}, ${r.kind}]${changed}`);
    for (const d of r.diffs) console.log(`    - ${d}`);
  }
}

// Alles bewaren, om varianten later naast elkaar te leggen
const dir = join(ROOT, 'testset', 'resultaten');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const file = join(dir, `${stamp}_${opts.stt}_${model}_${version}.json`);
writeFileSync(
  file,
  JSON.stringify(
    {
      export: positionals[0],
      stt: opts.stt,
      model,
      promptVersion: version,
      durationMs: Date.now() - started,
      skipped,
      results,
    },
    null,
    2,
  ),
);
console.log(`\nBewaard in ${file.replace(ROOT + '/', '')}`);
