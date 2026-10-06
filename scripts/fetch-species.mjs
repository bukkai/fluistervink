// Haalt de Nederlandse vogellijst en de codes voor gedrag/methode/kleed op
// bij de openbare API van waarneming.nl en schrijft ze naar data/.
//
// Gebruik: node scripts/fetch-species.mjs

import { writeFile, mkdir } from 'node:fs/promises';

const API = 'https://waarneming.nl/api/v1';
const REGION_LIST_NL_BIRDS = 5001; // regio 200 (Nederland) × soortgroep 1 (Vogels)
const BIRDS = 1;

// Zeldzaamheid: 1 algemeen, 2 vrij algemeen, 3 zeldzaam, 4 zeer zeldzaam, 0 onbekend.
// Zeer zeldzame soorten en exoten laten we weg: die zeg je zelden in en ze
// vergroten de kans dat het model een verkeerde soort kiest.
const RARITIES = [1, 2, 3];
// S = soort, M = verzamelsoort ("Noordse Stern of Visdief", "Kwikstaart onbekend").
const TYPES = ['S', 'M'];
// Niet-inheemse soorten staan in de bron vaak als "algemeen" omdat er veel
// ontsnapte exemplaren gemeld worden. Daarom alleen deze gevestigde exoten.
const EXOTICS = [
  'Steenduif', 'Fazant', 'Nijlgans', 'Grote Canadese Gans', 'Kleine Canadese Gans',
  'Canadese Gans onbekend', 'Indische Gans', 'Mandarijneend', 'Carolina-eend',
  'Zwarte Zwaan', 'Halsbandparkiet', 'Grote Alexanderparkiet',
];

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json', 'Accept-Language': 'nl' },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const all = await get(`/region-lists/${REGION_LIST_NL_BIRDS}/species/`);
const missing = EXOTICS.filter((name) => !all.some((s) => s.name === name));
if (missing.length) console.warn(`Niet gevonden: ${missing.join(', ')}`);

const species = all
  .filter((s) => TYPES.includes(s.type))
  .filter((s) => (s.native && RARITIES.includes(s.rarity)) || EXOTICS.includes(s.name))
  .sort((a, b) => a.sort_order_taxonomy - b.sort_order_taxonomy)
  .map((s) => ({
    id: s.species,
    name: s.name,
    scientific: s.scientific_name,
    type: s.type,
    rarity: s.rarity,
  }));

const attrs = await get(`/species-groups/${BIRDS}/attributes/`);
const pick = (list) =>
  list.filter((x) => x.is_active !== false).map(({ id, text, name }) => ({ id, name: text ?? name }));

const attributes = {
  activity: pick(attrs.activity),
  method: pick(attrs.method),
  life_stage: pick(attrs.life_stage),
};

await mkdir('data', { recursive: true });
await writeFile('data/soorten-nl.json', JSON.stringify(species, null, 1) + '\n');
await writeFile('data/attributen-vogels.json', JSON.stringify(attributes, null, 1) + '\n');

console.log(`${species.length} soorten, ${attributes.activity.length} activiteiten, ` +
  `${attributes.method.length} methodes, ${attributes.life_stage.length} kleden`);
