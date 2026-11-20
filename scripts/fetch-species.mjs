// Haalt de Nederlandse soortenlijsten en de codes voor gedrag/methode/kleed op
// bij de openbare API van waarneming.nl en schrijft ze naar data/. Eerst
// vogels; daarnaast zoogdieren, reptielen en amfibieën, dagvlinders en
// libellen (docs/plan-soortgroepen.md).
//
// Daarnaast de Engelse namen van dezelfde soorten en codes (data/namen-en.json,
// docs/plan-engels.md) en de namen van eBird voor de eBird-export
// (data/ebird-namen.json, docs/plan-ebird.md).
//
// Met --landen ook de vogels van Spanje (data/soorten-es.json, proef van
// docs/plan-andere-landen.md), met een zeldzaamheid uit het aantal
// waarnemingen: ruim duizend aanroepen, een paar minuten. Niet elke week (de
// API geeft dan een 429, en de aantallen veranderen langzaam); zonder de vlag
// blijft de bestaande lijst staan en komen alleen de namen ervan mee.
//
// Gebruik: node scripts/fetch-species.mjs [--landen]

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
      'Chileense Flamingo',
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

/**
 * Engelse namen die in de bron ontbreken of onhandig zijn, per soort-ID (zoals
 * `names` per groep, maar dan voor data/namen-en.json).
 */
const NAMES_EN = {
  1003144: 'Passerine unknown',
  255102: 'Hooded Crow',
  719494: 'White butterfly unknown',
};

/**
 * eBird-namen die niet op naam te koppelen zijn (docs/plan-ebird.md, punt 5),
 * per soort-ID van waarneming.nl.
 */
const EBIRD_EXCEPTIONS = {
  80199: 'Rock Pigeon (Feral Pigeon)', // Stadsduif, zoals eBird het voorschrijft
  240802: 'duck sp.', // Eend onbekend
  18653: 'goose sp.', // Gans (Anser/Branta) onbekend
  682007: 'Eurasian Sparrowhawk/Eurasian Goshawk', // Havik of Sperwer onbekend
  1967: 'large alcid sp.', // Alk of Zeekoet
  1969: 'jaeger sp.', // Jager onbekend
  20645: 'storm-petrel sp.', // Stormvogeltje onbekend
  20707: 'parrot sp.', // Papegaai onbekend
  643350: 'treecreeper sp.', // Boomkruiper onbekend
  643328: 'Goldcrest/Common Firecrest', // Goudhaan onbekend
  87883: 'large falcon sp.', // Grote Valk onbekend of hybride
};

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
const byId = (codes) => Object.fromEntries(codes.map((c) => [c.id, c.name]));

const pick = (list) =>
  list
    .filter((x) => x.is_active !== false)
    .map(({ id, text, name }) => ({ id, name: text ?? name }));

const species = [];
const allSpecies = [];
const attributes = {};
// Engels: per ID de naam. Lijst (welke soorten, zeldzaamheid) en namen apart,
// zodat er later een taal bij kan zonder de lijst te herhalen
// (docs/plan-andere-landen.md, keuze 1).
const englishSpecies = new Map();
const englishAttributes = {};
for (const group of GROUPS) {
  const all = await get(`/region-lists/${5000 + group.id}/species/`);
  for (const s of await get(`/region-lists/${5000 + group.id}/species/`, 'en'))
    englishSpecies.set(s.species, s.name);
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
  const attrsEn = await get(`/species-groups/${group.id}/attributes/`, 'en');
  englishAttributes[group.file] = {
    activity: byId(pick(attrsEn.activity)),
    method: byId(pick(attrsEn.method)),
    life_stage: byId(pick(attrsEn.life_stage)),
  };
}

// ---------------------------------------------------------------------------
// Andere landen (docs/plan-andere-landen.md, "Proef Spanje"): alleen vogels.
// De zeldzaamheid in de regiolijsten is buiten Nederland en België grotendeels
// leeg (bijeneter en blauwe ekster "onbekend"), dus die rekenen we zelf uit
// het aantal waarnemingen per soort in dat land, als aandeel van het totaal.
// Geijkt op Nederland: alle algemene soorten van de bron komen er als
// algemeen uit.

const COUNTRIES = [{ code: 'es', country: 'ES', list: 267 }];

/** Per 100.000 waarnemingen in het land */
const PER = 100_000;
const IN_PROMPT = 2; // inheems, en verzamelsoorten
const IN_PROMPT_EXOTIC = 10; // gevestigde exoten wel, ontsnapte enkelingen niet
const RARITY_FROM_SHARE = [
  [150, 1],
  [30, 2],
  [5, 3],
];

/**
 * Aantal waarnemingen per soort in het land. Twee tegelijk; bij "te veel
 * verzoeken" (429) wachten zoals de server vraagt, en anders steeds langer.
 */
async function countsIn(country, ids) {
  const counts = new Map();
  const queue = [...ids];
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
  async function worker() {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const url = `${API}/species/${id}/observations/?country=${country}&limit=1`;
      for (let attempt = 1; ; attempt++) {
        const res = await fetch(url, { headers: { Accept: 'application/json' } }).catch(() => null);
        if (res?.ok) {
          counts.set(id, (await res.json()).count);
          break;
        }
        if (attempt === 8) throw new Error(`${url}: HTTP ${res?.status ?? 'geen verbinding'}`);
        const retryAfter = Number(res?.headers.get('retry-after'));
        await wait(retryAfter > 0 ? retryAfter : Math.min(60, 2 ** attempt));
      }
    }
  }
  await Promise.all([1, 2].map(worker));
  return counts;
}

const birds = GROUPS[0];
const dutchById = new Map(allSpecies.map((s) => [s.id, s]));
const dutchPromptIds = new Set(species.map((s) => s.id));
const countryLists = {};
const foreignSpecies = [];
const countAgain = process.argv.includes('--landen');
for (const { code, country, list } of COUNTRIES) {
  if (!countAgain) {
    // Niet opnieuw tellen: de bestaande lijst, alleen voor de Engelse en eBird-namen
    countryLists[code] = JSON.parse(await readFile(`data/soorten-${code}.json`, 'utf8'));
    for (const s of await get(`/region-lists/${list}/species/`, 'en'))
      if (!englishSpecies.has(s.species)) englishSpecies.set(s.species, s.name);
    for (const s of countryLists[code])
      if (!dutchById.has(s.id) && !foreignSpecies.some((f) => f.id === s.id))
        foreignSpecies.push(s);
    continue;
  }
  const source = (await get(`/region-lists/${list}/species/`)).filter((s) =>
    ALL_TYPES.includes(s.type),
  );
  for (const s of await get(`/region-lists/${list}/species/`, 'en'))
    if (!englishSpecies.has(s.species)) englishSpecies.set(s.species, s.name);
  const counted = source.filter((s) => s.type !== 'Y');
  const counts = await countsIn(
    country,
    counted.map((s) => s.species),
  );
  const total = counted
    .filter((s) => s.type === 'S')
    .reduce((sum, s) => sum + (counts.get(s.species) ?? 0), 0);
  const share = (s) => ((counts.get(s.species) ?? 0) / total) * PER;
  const rarity = (s) => RARITY_FROM_SHARE.find(([min]) => share(s) >= min)?.[1] ?? 4;
  const inPrompt = (s) =>
    birds.extraIds.includes(s.species) ||
    (s.type === 'S' && s.native ? share(s) >= IN_PROMPT : false) ||
    // Verzamelsoorten: ook alle van de Nederlandse prompt ("Eend onbekend"),
    // daar verwijzen de regels in de prompt naar
    (s.type === 'M' && (share(s) >= IN_PROMPT || dutchPromptIds.has(s.species))) ||
    (['S', 'F'].includes(s.type) && !s.native && share(s) >= IN_PROMPT_EXOTIC);
  countryLists[code] = [...source].sort(order(birds)).map((s) => ({
    id: s.species,
    // Dezelfde naam als in de Nederlandse lijst, met onze eigen correcties
    name: dutchById.get(s.species)?.name ?? birds.names[s.species] ?? s.name,
    scientific: s.scientific_name,
    type: s.type,
    // Een verzamelsoort ("Eend onbekend") is niet zeldzaam: geen zeldzaamheid,
    // anders maakt "zeldzaam wordt onzeker" hem onzeker
    rarity: ['S', 'F'].includes(s.type) ? rarity(s) : 0,
    group: birds.id,
    ...(inPrompt(s) && { prompt: true }),
  }));
  // Soorten die alleen in dit land staan (Iberische Tjiftjaf): ook een Engelse
  // en een eBird-naam
  for (const s of countryLists[code])
    if (!dutchById.has(s.id) && !foreignSpecies.some((f) => f.id === s.id)) foreignSpecies.push(s);
}

// Telmethode staat niet bij de attributen maar in /lookups/; de Nederlandse
// namen staan vast in src/lib/vocab.ts.
const lookupsEn = await get('/lookups/', 'en');
const englishCountingMethods = byId(pick(lookupsEn.counting_method));

// Per ID van de volledige lijst (alle groepen). Zonder Engelse naam geeft de
// bron de wetenschappelijke naam ("Accipiter spec."); die laten we weg, de app
// valt er toch op terug (speciesNameIn in vocab.ts).
const namesEn = {};
const withoutEnglish = [];
for (const s of [...allSpecies, ...foreignSpecies]) {
  const name = (NAMES_EN[s.id] ?? englishSpecies.get(s.id) ?? '').trim();
  if (name && name !== s.scientific) namesEn[s.id] = name;
  else if (s.type === 'S') withoutEnglish.push(s);
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
for (const [code, list] of Object.entries(countryLists))
  await writeFile(
    `data/soorten-${code}.json`,
    '[\n' + list.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n',
  );
for (const [file, attrs] of Object.entries(attributes))
  await writeFile(`data/attributen-${file}.json`, JSON.stringify(attrs, null, 1) + '\n');

// Compact (één soort per regel), net als soorten-nl-alle.json
const entries = (obj) =>
  Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
await writeFile(
  'data/namen-en.json',
  '{\n "species": {\n' +
    entries(namesEn).join(',\n') +
    '\n },\n "attributes": ' +
    JSON.stringify(englishAttributes, null, 1).replace(/\n/g, '\n ') +
    ',\n "counting_method": ' +
    JSON.stringify(englishCountingMethods) +
    '\n}\n',
);

const ebird = await ebirdNames(
  [...allSpecies, ...foreignSpecies].filter((s) => s.group === 1),
  namesEn,
);
await writeFile('data/ebird-namen.json', '{\n' + entries(ebird.names).join(',\n') + '\n}\n');

if (process.env.CHANGES_FILE) await writeFile(process.env.CHANGES_FILE, changes.join('\n') + '\n');
if (changes.length) console.log(changes.join('\n'));
if (withoutEnglish.length)
  console.log(
    `Soorten (type S) zonder Engelse naam (${withoutEnglish.length}): ` +
      withoutEnglish.map((s) => `${s.name} (${s.id})`).join(', '),
  );
console.log(
  `eBird: ${Object.keys(ebird.names).length} soorten gekoppeld; ` +
    `niet gekoppeld (zeldzaamheid 1–3): ${ebird.missing.map((s) => s.name).join(', ') || 'geen'}`,
);
for (const [code, list] of Object.entries(countryLists))
  console.log(
    `${code}: ${list.filter((s) => s.prompt).length} vogels in de prompt (alle: ${list.length})`,
  );
for (const group of GROUPS) {
  const a = attributes[group.file];
  const count = (list) => list.filter((s) => s.group === group.id).length;
  console.log(
    `${group.file}: ${count(species)} soorten (alle: ${count(allSpecies)}), ` +
      `${a.activity.length} activiteiten, ${a.method.length} methodes, ${a.life_stage.length} kleden`,
  );
}

/**
 * eBird-namen (Clements-taxonomie, Amerikaans Engels) per soort-ID van
 * waarneming.nl, voor de kolom "Common Name" van de eBird-export en later als
 * bijnamen voor wie in het Engels inspreekt. De taxonomie is openbaar, zonder
 * sleutel. Koppelen op wetenschappelijke naam; anders op de Engelse naam van
 * waarneming.nl, als precies één eBird-soort zo heet (bij een ander geslacht:
 * Winterkoning is bij waarneming.nl Nannus troglodytes, bij eBird Troglodytes
 * troglodytes). Wat niet te koppelen is, kiest de gebruiker bij de import van
 * eBird zelf ("Fix Species").
 */
async function ebirdNames(birds, namesEn) {
  const res = await fetch('https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&locale=en');
  if (!res.ok) throw new Error(`eBird-taxonomie: HTTP ${res.status}`);
  const taxonomy = await res.json();
  const bySci = new Map(taxonomy.map((t) => [sciKey(t.sciName), t.comName]));
  const byCommon = new Map();
  for (const t of taxonomy) {
    const key = t.comName.toLowerCase();
    byCommon.set(key, byCommon.has(key) ? null : t.comName);
  }
  const names = {};
  const missing = [];
  for (const s of birds) {
    const name =
      EBIRD_EXCEPTIONS[s.id] ??
      bySci.get(sciKey(s.scientific)) ??
      (namesEn[s.id] && byCommon.get(namesEn[s.id].toLowerCase()));
    if (name) names[s.id] = name;
    else if (s.rarity >= 1 && s.rarity <= 3 && s.type === 'S') missing.push(s);
  }
  return { names, missing };
}

/**
 * Wetenschappelijke naam zoals beide bronnen hem vergelijkbaar schrijven:
 * "Larus spec." en "Anatidae indet." worden "larus sp." en "anatidae sp."
 * (eBird: "gull sp.", "waterfowl sp."), "Anser anser f. domesticus" wordt
 * "anser anser (domestic type)", en "Cygnus cygnus / columbianus" wordt
 * "cygnus columbianus/cygnus cygnus" (elk deel met geslacht, op volgorde).
 */
function sciKey(name) {
  const key = name
    .toLowerCase()
    .replace(/\s+(spec|indet)\.$/, ' sp.')
    .replace(/\s+f\. domestic(a|us)$/, ' (domestic type)')
    .trim();
  if (!key.includes('/')) return key;
  let genus = '';
  const parts = key.split('/').map((part) => {
    const words = part.trim().split(/\s+/);
    if (words.length > 1) genus = words[0];
    return words.length > 1 ? words.join(' ') : `${genus} ${words[0]}`;
  });
  return parts.sort().join('/');
}
