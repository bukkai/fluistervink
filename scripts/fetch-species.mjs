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
// ontsnapte exemplaren gemeld worden. Daarom alleen deze gevestigde exoten en
// gedomesticeerde vormen (type F: Stadsduif, Parkgans = soepgans, Parkeend =
// soepeend, Chinese Knobbelgans). Let op: "Steenduif" is in de bron een
// Zuid-Amerikaanse grondduif, niet de stadsduif.
const EXOTICS = [
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
];

// Soorten die buiten de filters vallen maar die je wel inspreekt: Bonte Kraai
// (in de bron type Y), verzamelsoorten voor "een vogel" en "KBV" (klein
// bruin vogeltje), die zeldzaamheid 0 hebben, en Vale Pijlstormvogel ("vaaltje";
// in de bron een ondersoort, zeer zeldzaam, maar jaarlijks langs de kust).
const EXTRA_IDS = [67, 18926, 1003144, 369];
// Heeft in de bron geen Nederlandse naam
const NAMES = { 1003144: 'Zangvogel onbekend' };

async function get(path, language = 'nl') {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json', 'Accept-Language': language },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const all = await get(`/region-lists/${REGION_LIST_NL_BIRDS}/species/`);
const missing = EXOTICS.filter((name) => !all.some((s) => s.name === name));
if (missing.length) console.warn(`Niet gevonden: ${missing.join(', ')}`);

const toSpecies = (list) =>
  list
    .sort((a, b) => a.sort_order_taxonomy - b.sort_order_taxonomy)
    .map((s) => ({
      id: s.species,
      name: NAMES[s.species] ?? s.name,
      scientific: s.scientific_name,
      type: s.type,
      rarity: s.rarity,
    }));

const inPrompt = (s) =>
  EXTRA_IDS.includes(s.species) ||
  EXOTICS.includes(s.name) ||
  (TYPES.includes(s.type) && s.native && RARITIES.includes(s.rarity));
const species = toSpecies(all.filter(inPrompt));

// Volledige lijst voor het bewerkformulier: ook zeer zeldzame dwaalgasten
// (Dwergaalscholver, Kuifduiker) om een waarneming thuis goed te kunnen zetten.
// Zonder ondersoorten (I) en hybriden (H). Het model krijgt deze lijst niet.
const ALL_TYPES = ['S', 'M', 'F', 'Y'];
const allSpecies = toSpecies(all.filter((s) => inPrompt(s) || ALL_TYPES.includes(s.type)));

// Ook de Engelse namen: de bulkimport van waarneming.nl herkent gedrag, methode
// en kleed alleen aan de tekst in de taal van de site (zie docs/waarneming-nl.md).
const attrs = await get(`/species-groups/${BIRDS}/attributes/`);
const attrsEn = await get(`/species-groups/${BIRDS}/attributes/`, 'en');
const pick = (list, listEn) =>
  list
    .filter((x) => x.is_active !== false)
    .map(({ id, text, name }) => {
      const en = listEn.find((y) => y.id === id);
      return { id, name: text ?? name, en: en?.text ?? en?.name };
    });

const attributes = {
  activity: pick(attrs.activity, attrsEn.activity),
  method: pick(attrs.method, attrsEn.method),
  life_stage: pick(attrs.life_stage, attrsEn.life_stage),
};

await mkdir('data', { recursive: true });
await writeFile('data/soorten-nl.json', JSON.stringify(species, null, 1) + '\n');
// Compact (één soort per regel): deze lijst gaat in z'n geheel mee in de app
await writeFile(
  'data/soorten-nl-alle.json',
  '[\n' + allSpecies.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n',
);
await writeFile('data/attributen-vogels.json', JSON.stringify(attributes, null, 1) + '\n');

console.log(
  `${species.length} soorten (alle: ${allSpecies.length}), ${attributes.activity.length} activiteiten, ` +
    `${attributes.method.length} methodes, ${attributes.life_stage.length} kleden`,
);
