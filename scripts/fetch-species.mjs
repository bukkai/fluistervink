// Haalt de Nederlandse soortenlijsten en de codes voor gedrag/methode/kleed op
// bij de openbare API van waarneming.nl en schrijft ze naar data/. Eerst
// vogels; daarnaast zoogdieren, reptielen en amfibieën, dagvlinders en
// libellen (docs/plan-soortgroepen.md).
//
// Gebruik: node scripts/fetch-species.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const API = 'https://waarneming.nl/api/v1';

// Zeldzaamheid: 1 algemeen, 2 vrij algemeen, 3 zeldzaam, 4 zeer zeldzaam, 0 onbekend.
// Zeer zeldzame soorten en exoten laten we weg: die zeg je zelden in en ze
// vergroten de kans dat het model een verkeerde soort kiest.
const RARITIES = [1, 2, 3];
// S = soort, M = verzamelsoort ("Noordse Stern of Visdief", "Kwikstaart onbekend").
const TYPES = ['S', 'M'];
// Voor de volledige lijst ook gedomesticeerde vormen (F) en soorten die de bron
// apart groepeert (Y); zonder ondersoorten (I) en hybriden (H).
const ALL_TYPES = ['S', 'M', 'F', 'Y'];

/**
 * Per soortgroep van waarneming.nl. De regiolijst is 5000 + groep (regio 200,
 * Nederland). `file`: data/attributen-<file>.json met gedrag, methode en kleed.
 *
 * `exotics`: niet-inheemse soorten staan in de bron vaak als "algemeen" omdat
 * er veel ontsnapte exemplaren gemeld worden. Daarom alleen deze gevestigde
 * exoten en gedomesticeerde vormen.
 *
 * `extraIds`: soorten die buiten de filters vallen maar die je wel inspreekt.
 * `names`: geen of een onhandige Nederlandse naam in de bron.
 */
const GROUPS = [
  {
    id: 1,
    file: 'vogels',
    // Type F: Stadsduif, Parkgans = soepgans, Parkeend = soepeend, Chinese
    // Knobbelgans. Let op: "Steenduif" is in de bron een Zuid-Amerikaanse
    // grondduif, niet de stadsduif.
    exotics: [
      'Stadsduif',
      'Parkgans',
      'Parkeend',
      'Zwaangans',
      'Chinese Knobbelgans',
      'Fazant',
      'Nijlgans',
      'Grote Canadese Gans',
      'Kleine Canadese Gans',
      'Canadese Gans onbekend',
      'Indische Gans',
      'Mandarijneend',
      'Carolina-eend',
      'Zwarte Zwaan',
      'Halsbandparkiet',
      'Grote Alexanderparkiet',
    ],
    // Bonte Kraai (sinds nov 2026 een ondersoort van de Zwarte Kraai, type I;
    // vroeger soort 67, zie REPLACED in src/lib/vocab.ts), verzamelsoorten voor
    // "een vogel" en "KBV" (klein bruin vogeltje), die zeldzaamheid 0 hebben, en
    // Vale Pijlstormvogel ("vaaltje"; in de bron een ondersoort, zeer zeldzaam,
    // maar jaarlijks langs de kust).
    extraIds: [255102, 18926, 1003144, 369],
    names: { 1003144: 'Zangvogel onbekend', 255102: 'Bonte Kraai' },
  },
  {
    id: 2,
    file: 'zoogdieren',
    exotics: [
      'Damhert',
      'Muskusrat',
      'Beverrat',
      'Gewone Wasbeer',
      'Amerikaanse Nerts',
      'Sikahert',
      'Chinese Muntjak',
    ],
    // "Haas of Konijn": zeldzaamheid 0, maar in de schemer vaak het eerlijke antwoord
    extraIds: [674241],
    names: { 674241: 'Haas of Konijn' },
  },
  { id: 3, file: 'reptielen-amfibieen', exotics: [], extraIds: [], names: {} },
  {
    id: 4,
    file: 'dagvlinders',
    exotics: [],
    // Dikkopje onbekend en Pieridae indet. ("een witje"): zeldzaamheid 0
    extraIds: [674217, 719494],
    names: { 719494: 'Witje onbekend' },
  },
  { id: 5, file: 'libellen', exotics: [], extraIds: [], names: {} },
];

async function get(path, language = 'nl') {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json', 'Accept-Language': language },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// Vogels op de volgorde van de taxonomie, zoals de lijst altijd was. Bij de
// andere groepen ontbreekt die volgorde vaak (9999999); daar op naam.
const order = (group) =>
  group.id === 1
    ? (a, b) => a.sort_order_taxonomy - b.sort_order_taxonomy
    : (a, b) => a.name.localeCompare(b.name, 'nl');

const toSpecies = (group, list) =>
  [...list].sort(order(group)).map((s) => ({
    id: s.species,
    name: group.names[s.species] ?? s.name,
    scientific: s.scientific_name,
    type: s.type,
    rarity: s.rarity,
    group: group.id,
  }));

// De bulkimport van waarneming.nl herkent gedrag, methode en kleed alleen aan
// de tekst in de taal van de site; de app exporteert deze Nederlandse namen
// (zie docs/waarneming-nl.md).
const pick = (list) =>
  list
    .filter((x) => x.is_active !== false)
    .map(({ id, text, name }) => ({ id, name: text ?? name }));

const species = [];
const allSpecies = [];
const attributes = {};
for (const group of GROUPS) {
  const all = await get(`/region-lists/${5000 + group.id}/species/`);
  const missing = group.exotics.filter((name) => !all.some((s) => s.name === name));
  if (missing.length) console.warn(`${group.file}: niet gevonden: ${missing.join(', ')}`);
  const missingIds = group.extraIds.filter((id) => !all.some((s) => s.species === id));
  if (missingIds.length)
    console.warn(`${group.file}: extraIds niet gevonden: ${missingIds.join(', ')}`);

  const inPrompt = (s) =>
    group.extraIds.includes(s.species) ||
    group.exotics.includes(s.name) ||
    (TYPES.includes(s.type) && s.native && RARITIES.includes(s.rarity));
  species.push(...toSpecies(group, all.filter(inPrompt)));
  // Volledige lijst voor het bewerkformulier: ook zeer zeldzame dwaalgasten
  // (Dwergaalscholver, Kuifduiker) om een waarneming thuis goed te kunnen
  // zetten. Het model krijgt deze lijst niet.
  allSpecies.push(
    ...toSpecies(
      group,
      all.filter((s) => inPrompt(s) || ALL_TYPES.includes(s.type)),
    ),
  );

  const attrs = await get(`/species-groups/${group.id}/attributes/`);
  attributes[group.file] = {
    activity: pick(attrs.activity),
    method: pick(attrs.method),
    life_stage: pick(attrs.life_stage),
  };
}

// Wat er veranderd is ten opzichte van de vorige lijst, voor de beschrijving
// van de pull request (.github/workflows/soortenlijst.yml). Een nieuwe
// wetenschappelijke naam is het belangrijkst: de import van waarneming.nl
// herkent een soort alleen daaraan.
const previous = JSON.parse(await readFile('data/soorten-nl-alle.json', 'utf8').catch(() => '[]'));
const before = new Map(previous.map((s) => [s.id, s]));
const after = new Map(allSpecies.map((s) => [s.id, s]));
const changes = [];
for (const s of allSpecies) {
  const old = before.get(s.id);
  if (!old) changes.push(`- Nieuw: ${s.name} (*${s.scientific}*)`);
  else if (old.scientific !== s.scientific)
    changes.push(`- ${s.name}: *${old.scientific}* → *${s.scientific}*`);
  else if (old.name !== s.name) changes.push(`- ${old.name} → ${s.name}`);
}
for (const s of previous)
  if (!after.has(s.id)) changes.push(`- Weg: ${s.name} (*${s.scientific}*)`);

// Bijnamen die naar een soort verwijzen die niet meer in de prompt staat
const aliases = JSON.parse(await readFile('data/bijnamen.json', 'utf8'));
const promptIds = new Set(species.map((s) => s.id));
for (const a of aliases)
  if (!promptIds.has(a.soort))
    changes.push(
      `- **Let op:** bijnaam voor ${a.naam} (${a.soort}) verwijst naar een soort die niet meer in de prompt staat`,
    );

await mkdir('data', { recursive: true });
await writeFile('data/soorten-nl.json', JSON.stringify(species, null, 1) + '\n');
// Compact (één soort per regel): deze lijst gaat in z'n geheel mee in de app
await writeFile(
  'data/soorten-nl-alle.json',
  '[\n' + allSpecies.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n',
);
for (const [file, attrs] of Object.entries(attributes))
  await writeFile(`data/attributen-${file}.json`, JSON.stringify(attrs, null, 1) + '\n');

if (process.env.CHANGES_FILE) await writeFile(process.env.CHANGES_FILE, changes.join('\n') + '\n');
if (changes.length) console.log(changes.join('\n'));
for (const group of GROUPS) {
  const a = attributes[group.file];
  const count = (list) => list.filter((s) => s.group === group.id).length;
  console.log(
    `${group.file}: ${count(species)} soorten (alle: ${count(allSpecies)}), ` +
      `${a.activity.length} activiteiten, ${a.method.length} methodes, ${a.life_stage.length} kleden`,
  );
}
