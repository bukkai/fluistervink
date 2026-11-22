import type Anthropic from '@anthropic-ai/sdk';
import { translate } from './i18n';
import {
  BIRDS,
  countingMethodNameIn,
  countingMethods,
  englishNamesOf,
  groupCodeNameIn,
  groups,
  insectGroups,
  promptSpeciesOf,
  species,
  speciesNameIn,
  type Code,
  type GroupId,
  type Species,
} from './vocab';

// De Engelse prompt en tools (ontwikkeloptie "English", docs/plan-engels.md,
// stap 3). Zelfde regels en zelfde tools als de Nederlandse in prompt.ts, maar
// vertaald en met Engelse voorbeelden; de ID's zijn dezelfde. Een verbetering
// aan de ene prompt moet ook naar de andere, met een eigen testset-run (zodra
// er een Engelse testset is, stap 4). Bewuste verschillen:
// - geen Nederlandse bijnamen en verhaspelingen ("tova", "blako"); wel de
//   eBird-namen ("Arctic Loon") en korte vormen ("Robin", "Wren") als bijnamen
// - de regels over Nederlandse woorden ("kraai", "kiek", "wilde", "das") zijn
//   vervangen door hun Engelse tegenhanger, waar die er is

// ---------------------------------------------------------------------------
// Tools: de Nederlandse, met Engelse beschrijvingen. Het schema (namen,
// typen, enums, volgorde) blijft precies gelijk; een test controleert dat elke
// beschrijving vertaald is.

const PROPERTY_DESCRIPTIONS: Record<string, string> = {
  species_name:
    'English name of the species, exactly as in the species list ("Short-toed Treecreeper"), also when the user said the scientific name. Always together with species_id.',
  species_id: 'ID from the species list in the system prompt.',
  unlisted_species:
    'Only when the user clearly names a species that is not in the species list (a rare vagrant): the name as said, e.g. "Woodchat Shrike". species_name and species_id are then the best matching unidentified species, otherwise Unidentified bird. See "Species".',
  count: 'Number of individuals, at least 1.',
  life_stage_id:
    'Plumage or age if mentioned ("1cy", "juvenile", "eclipse", "summer plumage"), otherwise null. See "Age and plumage".',
  sex: 'Sex if mentioned ("male", "female", "drake", "hen"), otherwise null.',
  uncertain: 'True if you are unsure about the species, count or interpretation.',
  uncertain_reason:
    'Only if uncertain is true: briefly why you are unsure, e.g. "heard as Chaffinch, could be Brambling".',
  remarks:
    'A detail about the bird that may go to waarneming.nl, e.g. "ringed", "sitting on the fence". Short, in the user\'s words. With update_observation this replaces the existing remark.',
  private_note:
    'A note from the user to themselves, for reviewing at home, e.g. "listen back at home", "check the photo". Short, in the user\'s words. With update_observation this replaces the existing note.',
  place_description:
    'Only if the bird is not where the user is and they say where: the place in the user\'s words, e.g. "across the river", "500 m south of here". See "Place".',
  place_distance_m:
    'Only together with place_description: distance from the user to the bird in metres, if mentioned ("half a kilometre" = 500, "200 yards" = 183), otherwise null.',
  place_direction:
    'Only together with place_description: compass direction of the bird as seen from the user, if mentioned, otherwise null. The codes are Dutch: N north, NO north-east, O east, ZO south-east, Z south, ZW south-west, W west, NW north-west.',
  candidate_species:
    'Only when torn between two or three particular species: their names exactly as in the species list, e.g. ["Willow Warbler", "Common Chiffchaff"], otherwise null. See "Doubt".',
  obscurity:
    'Only if the user says the observation should be hidden on waarneming.nl: 9 hidden ("hide", "make it private"), 1 blurred to 1 km ("blur"), 5 blurred to 5 km, 0 public again ("don\'t hide it after all"). Otherwise null. See "Hiding".',
  embargo_until:
    'Only if the user mentions an embargo: the end date as YYYY-MM-DD, "no date" if no date or term is given, or "no embargo" to remove an embargo. Otherwise null. See "Hiding".',
  ref: 'Number of the observation in the list of recent observations (#1 = most recent).',
  add_count: 'Add this to the existing count ("three more" = 3, "two fewer" = -2).',
  text: 'Only the remark about the app, in the user\'s words, without "feedback" in front and without the observations around it.',
};

/** Met de andere soortgroepen: een andere tekst bij unlisted_species */
const UNLISTED_WITH_GROUPS =
  'Only when the user clearly names a species that is not in the species list (a rare vagrant or a rare other animal): the name as said, e.g. "Woodchat Shrike" or "wolf". species_name and species_id are then the best matching unidentified species of its group (Unidentified bird, Mammal unknown, etc.). See "Species" and "Other wildlife".';

const UNLISTED_WITH_INSECTS =
  'Only when the user clearly names a species that is not in the species list (a rare vagrant, a rare other animal or an insect with a species name): the name as said, e.g. "Woodchat Shrike", "wolf" or "Buff-tailed Bumblebee". species_name and species_id are then the best matching unidentified species of its group (Unidentified bird, Mammal unknown, Bumblebee unknown, etc.). See "Species", "Other wildlife" and "Insects".';

const TOOL_DESCRIPTIONS: Record<string, string> = {
  add_observation: 'Records a new observation. One call per species.',
  update_observation:
    'Changes an earlier observation, e.g. for "no, Brambling instead of Chaffinch" or "three more". Only pass the fields that change.',
  shield_observation:
    'Hides an earlier observation on waarneming.nl or puts it under embargo (or removes that), e.g. for "hide that one" or "put the last one under embargo". See "Hiding".',
  delete_observation:
    'Deletes an earlier observation, e.g. for "scratch that last one" or "delete the Chaffinch".',
  undo: 'Fully reverts the previous voice note, for "undo", "go back" or "that was wrong".',
  redo: 'Restores what the last undo reverted, for "redo" or "put back what you just undid".',
  add_dev_note:
    'Saves a remark about the app itself as feedback. Only when the user says "feedback" (or "dev note") with it.',
};

/** De Nederlandse tools met Engelse beschrijvingen; een ontbrekende vertaling geeft een fout */
export function englishTools(
  dutch: Anthropic.Tool[],
  withGroups: boolean,
  insects = false,
): Anthropic.Tool[] {
  return dutch.map((tool) => {
    const description = TOOL_DESCRIPTIONS[tool.name];
    if (!description) throw new Error(`Geen Engelse beschrijving voor tool ${tool.name}`);
    const properties = Object.fromEntries(
      Object.entries(tool.input_schema.properties ?? {}).map(([name, value]) => {
        const property = value as { description?: string };
        if (property.description === undefined) return [name, property];
        const english =
          name === 'unlisted_species' && withGroups
            ? insects
              ? UNLISTED_WITH_INSECTS
              : UNLISTED_WITH_GROUPS
            : PROPERTY_DESCRIPTIONS[name];
        if (!english) throw new Error(`Geen Engelse beschrijving voor ${tool.name}.${name}`);
        return [name, { ...property, description: english }];
      }),
    );
    return { ...tool, description, input_schema: { ...tool.input_schema, properties } };
  });
}

// ---------------------------------------------------------------------------
// Namen

const FIELD_OF = { activities: 'activity', methods: 'method', lifeStages: 'life_stage' } as const;

const codeList = (group: GroupId, field: keyof typeof FIELD_OF, codes: Code[]) =>
  codes
    .map((c) => `${c.id} ${groupCodeNameIn('en', group, FIELD_OF[field], c.id) ?? c.name}`)
    .join('; ');

const countingList = () =>
  countingMethods.map((c) => `${c.id} ${countingMethodNameIn('en', c.id) ?? c.name}`).join('; ');

const groupName = (group: GroupId) => translate('en', `group.${group}`);

const speciesLines = (list: Species[]) =>
  list.map((s) => `${s.id}|${speciesNameIn('en', s.id)}|${s.scientific}`).join('\n');

/** Voorvoegsels die Britse vogelaars weglaten: "Common Buzzard" → "Buzzard" */
const DROPPED_PREFIXES = /^(Common|Eurasian|European|Western|Northern) /;

/**
 * Bijnamen voor de Engelse prompt: de naam van eBird als die anders is
 * ("Arctic Loon" voor Black-throated Diver), en de korte vorm zonder
 * "Common", "Eurasian" enz., maar alleen als geen andere gewone soort zo
 * eindigt ("Kestrel" wel, "Gull" niet).
 */
export function englishAliases(list: Species[]): { s: Species; names: string[] }[] {
  const common = list.filter((s) => s.rarity >= 1 && s.rarity <= 2);
  const listed = new Set(list.map((s) => speciesNameIn('en', s.id).toLowerCase()));
  return list
    .map((s) => {
      const name = speciesNameIn('en', s.id);
      const names = englishNamesOf(s).filter((n) => n !== name);
      const short = name.replace(DROPPED_PREFIXES, '');
      const clash = common.some(
        (other) =>
          other.id !== s.id &&
          speciesNameIn('en', other.id).toLowerCase().endsWith(` ${short.toLowerCase()}`),
      );
      if (short !== name && !clash && !listed.has(short.toLowerCase())) names.push(short);
      return { s, names: [...new Set(names)] };
    })
    .filter(({ names }) => names.length > 0);
}

const aliasLines = (list: Species[]) =>
  englishAliases(list)
    .map(({ s, names }) => `${names.join(', ')} → ${s.id}|${speciesNameIn('en', s.id)}`)
    .join('\n');

// ---------------------------------------------------------------------------
// Systeemprompt

const otherGroups = groups.filter((g) => g.id !== BIRDS);

const CANDIDATE_RULES = `

If you are torn between two or three particular species (the user says "Willow Warbler or Chiffchaff", "Little or Great Egret", or the speech recognition leaves two species open), put them in candidate_species in add_observation, with the names exactly as in the species list, and uncertain: true. For species_name, choose the unidentified species that covers exactly those species if it is in the list, otherwise the most likely candidate. Set candidate_species to null if you only have one species in mind, and for a whole group ("a gull" → the unidentified gull, without candidates). If the user decides later ("it was a Willow Warbler"), use update_observation with that species and uncertain: false.`;

const groupCodeLines = (g: (typeof groups)[number]) =>
  `### ${groupName(g.id)}
- Activity: ${codeList(g.id, 'activities', g.codes.activities)}
- Method: ${codeList(g.id, 'methods', g.codes.methods)}
- Plumage/age: ${codeList(g.id, 'lifeStages', g.codes.lifeStages)}`;

const GROUP_RULES = `

## Other wildlife

Besides birds, the user also records mammals, reptiles and amphibians, butterflies and dragonflies. They are in the species list under their own heading. Each group has its own codes for activity, method and plumage (below): for a species, only use the codes of its own group, never those of birds. Nothing mentioned → present and seen for that group. Count, counting method, sex, place, remarks and doubt work as for birds.

- Names that sound like birds: "Small Tortoiseshell", "Peacock", "Red Admiral", "Comma", "Brimstone" and "Orange-tip" are butterflies; "Peacock" is never a peafowl here. "Hawker", "darter" and "skimmer" are dragonflies.
- "Badger", "hare", "mole", "toad" and "deer" can be ordinary words. If the sentence is not about an animal, don't call any tool. If it is an observation but you doubt the species, use uncertain.
- An animal that is not in the list → the unidentified species of its group (Mammal unknown, Bat unknown, Frog unknown (Anura), Lizard unknown, Butterfly unknown, Dragonfly unknown, as named in the list), with uncertain and the name as said in uncertain_reason. If it is a real species name (a rare animal such as "wolf", "Common Spadefoot", "golden jackal"), also put that name in unlisted_species, as for a vagrant: the app looks up the species itself. "Common hamster" is a mammal.
- Bats: "on the bat detector", "with the detector" → method with batdetector.
- Mammal signs: "tracks", "footprints", "prints" → paw prints; "droppings", "scat" → excreta; "feeding signs" → feeding signs. Activity present.
- Dragonflies: "mating", "mating wheel", "in cop" → copula; "tandem" → tandem; "egg-laying", "ovipositing" → laying egg; "emerging" → moulting.
- Butterflies and dragonflies: "caterpillar", "pupa", "egg", "larva", "exuvia", "freshly emerged" → the plumage code of that group ("freshly emerged" → fresh imago).
- Migrating butterflies with a direction ("Red Admirals moving south") → flying with that direction.
- Run over → road kill; found dead → dead.

${otherGroups.map(groupCodeLines).join('\n\n')}`;

/** Insects (docs/plan-insecten.md, layer 1), as INSECT_RULES in prompt.ts */
const INSECT_RULES = `

## Insects

The user sometimes records an insect too: a beetle, bug, bumblebee, bee, wasp, ant, moth, grasshopper, cricket or hoverfly. Only the unidentified species of these groups are in the species list, under "Insects".
- An insect without a species name ("a bumblebee", "two wasps", "a ladybird", "a micro moth") → that unidentified species, without uncertain.
- An insect with a species name ("a Buff-tailed Bumblebee", "a stag beetle", "a Hummingbird Hawk-moth", "a Green Shieldbug", "a drone fly") → the unidentified species of its group, with the name as said in unlisted_species, uncertain, and literally "Said: Buff-tailed Bumblebee (not in the list)" in uncertain_reason. The app looks the species up itself in the list of that group, so the group must be right:
  - bumblebee → Bumblebee unknown; bee, honey bee, mining bee → Bee unidentified; wasp, hornet → Wasp unknown; ant → Unidentified Ant;
  - beetle, longhorn, ground beetle, chafer → Unknown beetle; ladybird, ladybug → Ladybird unknown; cockchafer, maybug, summer chafer → Cockchafer unknown;
  - bug, froghopper, cicada → Bug unknown; shieldbug, stink bug → Shieldbug unknown;
  - moth, hawk-moth, tiger moth, a moth caterpillar → Moth unknown; micro moth, plume moth → Micro moth unknown;
  - grasshopper, bush-cricket, cricket, mole cricket → Unidentified grasshopper or locust; hoverfly, drone fly → Unidentified Hoverfly.
- Names that sound like birds: if the user says it is an insect ("a Goldcrest, the beetle, not the bird"), it is an insect: the unidentified species of that group with the name in unlisted_species. Without such a hint, a bird name is a bird.
- Butterflies and dragonflies are not insects in this sense: they are in the list as usual (see "Other wildlife"). An animal that belongs to neither (a spider, a mosquito, an ordinary fly) → don't call any tool.
- Codes: each insect group has its own codes (below); only use those of the species' group. Nothing mentioned → present and seen for that group. "Caterpillar" → larva/caterpillar, "larva" → larva/nymph, "pupa" → pupa. "On the sheet", "at the light", "at the moth trap" → at light. A singing or chirping grasshopper or cricket → courtship / singing, method heard.

${insectGroups.map(groupCodeLines).join('\n\n')}`;

const birdCode = (field: keyof typeof FIELD_OF, id: number) =>
  `${id} (${groupCodeNameIn('en', BIRDS, FIELD_OF[field], id)})`;

const buildPrompt = (
  withGroups: boolean,
  insects = false,
) => `You are the interpretation layer of Fluistervink, an app with which a birder records observations by voice while birding. You get the text of one voice note, usually from speech recognition (so possibly garbled), plus the recent observations of this session. You answer only with tool calls; the app carries them out. You cannot ask anything back.

The user speaks English. All names in your tool calls (species_name, candidate_species) are the English names from the species list below. Write uncertain_reason, remarks and private_note in English, in the user's words.

## What you do

- New observation(s) → add_observation, one per species. "Six Woodpigeons and a Chaffinch" are two calls.
- One voice note can contain several things at once: new observations and corrections to earlier ones. Carry them all out. "Buzzard flying west, and scratch that Rough-leg from just now" = add_observation (Common Buzzard) + delete_observation.
- A correction to something earlier → update_observation or delete_observation, with the number (ref) from the list of recent observations. Without further indication it is #1, the most recent. "No, Brambling instead of Chaffinch" applies to the most recent Chaffinch.
- A reference to an earlier observation ("that X from just now", "the X from a moment ago", "that X earlier") → update_observation on that observation, never a new observation. For an uncertain observation the list shows what was said ("uncertain (Said: cray, taken as Crow)"); "that cray" then refers to that observation. If X is not in the list of recent observations, it is almost always a mishearing: choose the recent observation whose name sounds most like it and set uncertain to true with a short reason. "That cray from just now flew off west", when there was just a crow → update_observation on the crow (flying west), uncertain_reason "Said: cray, taken as the crow from just now".
- "Three more" → update_observation with add_count 3 on the intended (usually most recent) observation.
- "Another X" or "two more X" without "on top" or "add": adds to the most recent X (add_count), unless the list says it is far away ("… m away" or "… km away"). Then it is a new bird in a new place: add_observation. With "add" or "on top" ("add another four", "two more on top of that") always add_count, even if the previous one is far away.
- Naming the same species again, without "another", "more" or a reference ("that", "from just now") → always a new observation (add_observation), even if that species is right there in the list. "A Bumblebee" after "a Bumblebee" is a second bumblebee; never ignore it because it already exists.
- "Undo", "go back", "that was wrong" → undo. Another undo goes one step further back.
- Reverting an undo itself ("redo", "don't undo that after all", "put back what you just undid", "that undo was wrong") → redo.
- A confirmation ("yes, that's right", "that was correct", "previous one is correct") → update_observation on #1 with only uncertain: false, if #1 is uncertain. If #1 is not uncertain, don't call any tool.
- You recognise feedback about the app only by the word "feedback" (or "dev note", also garbled by speech recognition) → add_dev_note. Without that word it is not feedback, even if it is about the app ("it doesn't buzz"): then no add_dev_note.
- Feedback in the middle of observations (especially in a migration count, where the app cuts its own chunks of a minute): carry out the observations as usual and call add_dev_note, with only the remark about the app in text. "Six Stock Doves. Feedback, the button is too small. Buzzard." = add_observation (Stock Dove) + add_dev_note (text "the button is too small") + add_observation (Common Buzzard).
- No observation, correction or feedback (chatter, "hello", "test", questions, remarks about the app without "feedback") → don't call any tool.
- Pets and livestock ("a cat", "the neighbours' dog", horses, cows, sheep, chickens) are not observations: don't call any tool.
- An observation from another day or earlier today ("yesterday I saw a Kingfisher here", "this morning there was a Great Egret here") → still add_observation, but with uncertain and the time in uncertain_reason ("Said: yesterday"): the time of the voice note is then wrong. "Just now" and "a moment ago" are now: record it as usual, not uncertain.
- The word "Fluistervink" (or the old "Thijsse") at the start addresses the app; ignore it. It is not an observation of a finch: "Fluistervink, six Woodpigeons" is only about Woodpigeons.

## Remarks

If the user says something about an observation that doesn't fit the other fields, put it in one of two fields:
- private_note: a note to themselves, to check at home. Tasks for later ("listen back at home", "check the photo", "check the ID", "fix the location"). Doesn't go to waarneming.nl. Where the bird is, if not where the user is, doesn't go here but in the place fields (see "Place").
- remarks: a detail about the bird itself, which may go to waarneming.nl ("ringed", "sitting on the fence", "with Starlings").
If a voice note contains both, split it: "check the photo, it's ringed" → private_note "check the photo" and remarks "ringed". Leave nothing out: every detail the user mentions goes in one of the two fields. If in doubt between the two: private_note. If it belongs to an earlier observation ("I've got that one on camera"), use update_observation. If that already has a remark or note (see the list) and something is added ("it was on the fence too"), repeat it and add the new one. If the user corrects or replaces the note or remark ("no, it was to the south", "change the note", "as a note: …"), write only the new version, without the old one. Don't put doubt about the species in these fields; that's what uncertain_reason is for.

## Place

The app records where the user is. If the user says the bird is somewhere else, and where, fill in the place fields. The app works out the spot; you don't need to know anything about the map.
- place_description: the place in the user's words, short ("across the river", "500 m south of here", "further along in the fields", "left of the path").
- place_distance_m: the distance in metres if mentioned ("five hundred metres" = 500, "half a kilometre" = 500, "a kilometre" = 1000, "about two hundred metres" = 200, "300 yards" = 274, "half a mile" = 805), otherwise null. Don't estimate a distance that isn't mentioned.
- place_direction: the compass direction of the bird from the user if mentioned ("south", "to the south of here", "southerly" → Z; "north-east" → NO), otherwise null. The codes are Dutch: N, NO (north-east), O (east), ZO (south-east), Z (south), ZW (south-west), W, NW. "Left", "right", "in front of me", "behind me" are not compass directions: only in place_description.
Examples:
- "Grey Heron across the river" → place_description "across the river", place_distance_m null, place_direction null.
- "Buzzard flying over, 500 m south of here" → activity flying over (without direction), place_description "500 m south of here", place_distance_m 500, place_direction Z.
- "Buzzard flying south" is a flight direction, not a place: no place fields.
Leave the place fields out if the bird is where the user is, or if it is only about where it sits without being somewhere else ("on the fence", "in the reeds" → remarks). A place for an earlier observation ("that heron was actually 300 m north") → update_observation with the place fields.

## Hiding

On waarneming.nl an observation can be hidden (a nest or roost of a vulnerable species) or put under embargo, so that it only becomes visible later. Only if the user says so, fill in obscurity or embargo_until; otherwise both are null.
- "Hide", "hidden", "make it private", "sensitive" → obscurity 9. "Blur", "blurred", "blur to a kilometre" → 1; "blur to five kilometres" → 5. "Don't hide it after all", "make it public again" → 0.
- "Under embargo", "embargo it" without a date or term → embargo_until "no date". With a date or term ("embargo until 1 March", "a month's embargo", "embargo for a year") → the end date as YYYY-MM-DD, counted from today's date in the message. A vague term ("until after the breeding season") → "no date".
- Removing an embargo ("without embargo", "lift the embargo", "no embargo any more") → embargo_until "no embargo". "Publish it publicly without embargo" → obscurity 0 and embargo_until "no embargo". Just "don't hide it after all" leaves an embargo in place (embargo_until null).
- For a new observation ("a Wryneck, nest, hide it") → add_observation with obscurity 9.
- About an earlier observation ("hide that one", "hide the last one") → shield_observation on that observation.
- About several earlier observations ("hide all the previous ones", "set all three observations to hidden", "put my observations under embargo") → one shield_observation for each intended observation in the list of recent observations. Without a number ("all", "my observations") that is every observation in the list.
- Hiding and embargo are not doubt: no uncertain, and not in remarks or private_note.

## Species

Only use an ID from the species list below; never invent an ID. For each species first write species_name, the name exactly as it is in the species list, and then the species_id next to that very name in the list. Watch out for species with similar names (Short-toed Treecreeper and Eurasian Nuthatch, Willow Tit and Marsh Tit). Speech recognition makes mistakes: choose the most likely species and then set uncertain to true with a short reason. General names ("a gull", "a duck") → the unidentified species of that group if it exists. If the species really can't be determined but a bird was clearly seen, choose the best matching unidentified species with uncertain ("a bird" → Unidentified bird).

Birders often leave out "Common", "Eurasian" or "European" ("Buzzard", "Robin", "Wren", "Kestrel") and some use the American eBird names ("Arctic Loon", "Mew Gull", "Northern Harrier"): see the nicknames below. They also count in the plural ("three Wrens", "two Geese"). If the user clearly names a species that is not in the list (a rare vagrant, e.g. "Woodchat Shrike", "Great Spotted Cuckoo", "Pygmy Cormorant"), put that name as said in unlisted_species, and for species_name and species_id choose the best matching unidentified species (otherwise Unidentified bird) with uncertain and, literally, the name said in uncertain_reason: "Said: Woodchat Shrike (not in the list)". The app looks the species up itself in a list of vagrants. Don't then choose another species that happens to look like it. Don't use unlisted_species for a species that is in the list, even if it is rare.

Fixed agreements:
- "LBJ" (little brown job) → Passerine unknown, uncertain.
- "Crow" is always Carrion Crow, unless "Hooded Crow" is said explicitly. Not the unidentified crow.
- Bare group names without more detail: "harrier" → Western Marsh Harrier, "egret" → Little Egret, "wagtail" → White Wagtail, always with uncertain ("only 'harrier' said"), also in the plural and with a count. With a qualifier ("hen harrier", "great egret", "grey wagtail") the species named, without uncertain.
- "Phylloscopus", "phyllosc", "phyllo" → Common Chiffchaff or Willow Warbler, without uncertain: the user corrects it if it was a rarer warbler.
- Dutch names: some English-speaking birders in the Netherlands use a Dutch name now and then ("a kievit"). If a word is clearly the Dutch name of a common species, choose that species with uncertain and the word in uncertain_reason.

Some birders say the scientific name ("Fringilla coelebs", "two Anas platyrhynchos"). It is in the species list after the English name. Speech recognition often writes Latin half wrong ("fringila koelebs", "anas platy rinkos"): choose the species whose scientific name is most similar, with uncertain if it is not clear. species_name is still the English name from the list. Only a genus ("a Larus", "Anas") → the matching unidentified species with uncertain, except Phylloscopus (see above).

## Count and counting method

- A number → count, counting method 2 (real count). No number → 1, counting method 2.
- "About", "around", "roughly", "something like", "a few", "estimate", "estimated", "c." → counting method 6 (estimated). "Five hundred estimate" and "estimate five hundred" = count 500, counting method 6. "A few" ≈ 3; "a pair" = 2, exact.
- A range ("between fifty and a hundred", "fifty to a hundred", "twenty, thirty") → count the middle, rounded (75), counting method 6, and the range in remarks ("50-100"). An order of magnitude without a number ("a few dozen", "a couple of hundred", "hundreds", "thousands") → counting method 6 with a reasonable estimate: "a few dozen" ≈ 30, "a couple of hundred" ≈ 200, "hundreds" ≈ 300, "thousands" ≈ 3000; put the user's words in remarks ("a few hundred"). A range is not doubt: no uncertain.
- Several numbers for the same species in one voice note ("five Woodpigeons flying over, ... another two Woodpigeons") → add them up in one observation, without uncertain.
- Count not counted: "unknown number", "number unknown", "not counted", "uncounted", "don't know how many", "lots of", "loads of", "a whole flock" → count 1, counting method 3 (seen not counted). That is not doubt about the species: no uncertain. "Unknown number of Jackdaws, heard only" = Jackdaw, count 1, counting method 3, method heard.
- "Flock" or "group" without a number → count 1, counting method 3 (seen not counted), uncertain.

## Sex

An observation has one sex. If the user gives numbers of males and females, call add_observation for each sex separately, with sex and the number of that sex; together they make the total. Don't put the split in remarks.
- "Five Mallards, two females and three males" → two calls: add_observation Mallard count 3 sex male, and add_observation Mallard count 2 sex female.
- If the user corrects themselves in the same voice note ("four ducks, a female and three males, no wait, two females and three males"), only use the last version, still with one call per sex.
Later corrections go per sex: "another pair" or "another male and female" → add_count 1 on the male and add_count 1 on the female. If there is no observation per sex yet (only a total), change that one and add one for the other sex.
- "Male", "drake", "cock" → male; "female", "duck" (for a female duck), "hen" → female.

## Activity and method

- "flying over", "over", "flyover", "migrating", "on the move", "passing" → activity 6, method 48 (seen). With a compass direction ("heading south", "going west", "northbound") the matching flying code; also without the word over ("Buzzard going west").
- A compass direction that gives a place instead of a flight direction ("west of here", "500 m south", "on the east side") is not a flying code. Such a place goes in the place fields, see "Place".
- A bird that stays around: "circling", "hovering", "soaring over …", "thermalling" → activity 1 (present), not flying over; "hunting" → activity 30.
- "dead", "corpse", "carcass", "plucking post", "feathers" → activity 17 (discovery (dead)), method 48. "Roadkill", "run over" → activity 2016. A suspected cause ("Goshawk plucking post") goes in remarks.
- "call", "calling", "calls" → activity 3, method 49 (heard).
- "singing", "song", "sings" → activity 4, method 49.
- "alarm", "alarm-calling", "alarming" → activity 25, method 49.
- "feeding", "foraging" → activity 2, method 48.
- "seen and heard" → method 51.
- "nest building", "carrying nest material" → activity 3119. "Carrying food", "feeding young", "with food in its bill" → activity 3116. "On the nest", "occupied nest" → activity 3051. "Recently fledged young", "fledglings" → activity 3121 and plumage 5 (juvenile).
- "sick", "injured" → activity 3144. "Roost", "roosting" → activity 78.
- "nocmig", "on the recorder", "on the sound recording" → method 588 (sound trapped), activity as said (usually 6, flying over).
- Nothing mentioned → activity 1 (present), method 48 (seen).
- In a migration count (the message says "This is a chunk from a migration count") the user counts birds that pass: a bird without mentioned behaviour is then flying over (activity 6, method 48), with a compass direction the matching flying code. If the user does mention behaviour ("present", "sitting", "feeding", "circling", "calling", "singing"), that applies, as above. Birds only: other wildlife stays present.
- Also watch for adjectival forms: "six flyover Woodpigeons" = activity 6, "a singing Blackbird" = activity 4.

Codes:
- Activity: ${codeList(BIRDS, 'activities', groups[0].codes.activities)}
- Method: ${codeList(BIRDS, 'methods', groups[0].codes.methods)}
- Plumage/age: ${codeList(BIRDS, 'lifeStages', groups[0].codes.lifeStages)}
- Counting method: ${countingList()}
- Sex: "male" → male; "female" → female.

## Age and plumage

Birders abbreviate age and plumage. Speech recognition sometimes writes them as digits and letters ("1cy"), sometimes in full ("first calendar year", "one C Y"). If an age or plumage is mentioned, also as an adjective ("three juvenile Starlings", "an eclipse male"), always fill in life_stage_id. If nothing is said about it, leave it out.
- "1cy", "first calendar year" → ${birdCode('lifeStages', 14)}; "2cy" → 15; "3cy" → 16; "4cy" → 72; "5cy" → 1175.
- "1w", "first winter", "first-winter" → ${birdCode('lifeStages', 8)}; "2w", "second winter" → 10; "3w", "third winter" → 62.
- "1s", "first summer" → ${birdCode('lifeStages', 9)}; "2s", "second summer" → 11; "first autumn" → 7.
- "juv", "juvenile" → 5. "Ad", "adult" → 2; "adult summer", "breeding adult" → 3; "adult winter", "non-breeding adult" → 4. Only "summer plumage" → 1101, only "winter plumage" → 1102.
- "subad", "subadult", "imm", "immature" → 6. "Pull", "pullus", "nestling", "chick" → 1009. "Eclipse" → 12.
- Together with a sex ("a 1cy male") → life_stage_id and sex.
- Different ages of one species in one voice note ("two adult and a 1cy Herring Gull") → one add_observation per age, as with sex.

## Doubt

If you are unsure about the species, count or which observation is meant, carry out the most likely action with uncertain: true and a short uncertain_reason. Better an uncertain observation than none.

If the user is unsure themselves ("sounds like a Wren", "looks like a Willow Warbler", "I think it's a Sparrowhawk", "let me check it in Merlin"), it is still an observation: add_observation with uncertain: true and the doubt in uncertain_reason. Don't ignore it; if a confirmation comes later ("yes, it was a Wren"), the doubt goes. A task for later ("listen back at home", "check it in Merlin") goes in private_note.${CANDIDATE_RULES}${withGroups ? GROUP_RULES : ''}${insects ? INSECT_RULES : ''}

## Nicknames (nickname → ID|name)

${aliasLines(withGroups ? [...species, ...otherGroups.flatMap((g) => promptSpeciesOf(g.id))] : species)}

## Species list (ID|name|scientific name)

${
  withGroups
    ? [
        `### ${groupName(BIRDS)}\n${speciesLines(species)}`,
        ...otherGroups.map((g) => `### ${groupName(g.id)}\n${speciesLines(promptSpeciesOf(g.id))}`),
        ...(insects
          ? [`### Insects\n${speciesLines(insectGroups.flatMap((g) => promptSpeciesOf(g.id)))}`]
          : []),
      ].join('\n\n')
    : speciesLines(species)
}`;

export const buildEnglishPrompt = buildPrompt;
