import { db, type DeletedObservation, type Observation, type Utterance } from './db';
import { placeFromSpeech, type Place } from './spokenPlace';
import { convertCodes, getSpecies } from './vocab';

// Waarnemingen en uitspraken ophalen, en bewerken met de hand (review). De
// wachtrij staat in queue.ts, het uitvoeren van de acties van het model in
// applyActions.ts.

/** Waarnemingen van een sessie, nieuwste eerst. */
export async function listObservations(sessionId: string): Promise<Observation[]> {
  const all = await db.observations.where('sessionId').equals(sessionId).toArray();
  return all.sort((a, b) => b.observedAt - a.observedAt || b.createdAt - a.createdAt);
}

/** Uitspraken van een sessie, nieuwste eerst. */
export async function listUtterances(sessionId: string): Promise<Utterance[]> {
  const all = await db.utterances.where('sessionId').equals(sessionId).sortBy('recordedAt');
  return all.reverse();
}

/** Einde van de uitspraak: bij een opname het einde van de opname. */
export function spokenAt(utterance: Utterance): number {
  return utterance.recordedAt + (utterance.audioDurationMs ?? 0);
}

/**
 * Handmatige correctie in de review. De waarneming geldt daarna als
 * nagelopen; met de stem kan hij nog steeds aangepast worden. False als hij
 * er niet meer is (intussen met de stem verwijderd terwijl het formulier
 * openstond).
 */
export async function editObservation(id: string, patch: Partial<Observation>): Promise<boolean> {
  return db.transaction('rw', db.observations, async () => {
    const current = await db.observations.get(id);
    if (!current) return false;
    await db.observations.update(id, {
      ...patch,
      ...codesForNewSpecies(current, patch),
      editedAt: Date.now(),
      status: 'reviewed',
    });
    return true;
  });
}

/**
 * Alleen de velden die in het formulier echt anders zijn dan bij het openen.
 * Zo overschrijft Opslaan geen correctie met de stem die binnenkwam terwijl
 * het formulier openstond ("nee, keep" terwijl je het aantal aanpaste): wat
 * je zelf veranderde wint, de rest blijft zoals de stem het zette.
 */
export function changedFields(
  original: Observation,
  form: Partial<Observation>,
): Partial<Observation> {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  return Object.fromEntries(
    Object.entries(form).filter(([key, value]) => !same(value, original[key as keyof Observation])),
  ) as Partial<Observation>;
}

/**
 * Wordt een waarneming een soort van een andere groep ("nee, een vos"), dan
 * moeten gedrag, methode en kleed mee naar de codes van die groep. Alleen de
 * velden die de wijziging zelf niet zet: die zijn al van de nieuwe groep.
 */
export function codesForNewSpecies(
  current: Observation,
  patch: Partial<Observation>,
): Partial<Observation> {
  if (patch.speciesId === undefined || patch.speciesId === current.speciesId) return {};
  const keep: Partial<Observation> = {};
  for (const key of ['activityId', 'methodId', 'lifeStageId'] as const) {
    if (!(key in patch) && current[key] !== undefined) keep[key] = current[key];
  }
  const converted = convertCodes(keep, current.speciesId, patch.speciesId);
  if (converted === keep) return {};
  // Een kleed dat niet bestaat in de nieuwe groep: leeg, ook in de database
  if ('lifeStageId' in keep && converted.lifeStageId === undefined)
    converted.lifeStageId = undefined;
  return converted;
}

/** Nauwkeurigheid van een met de hand gezette plek, in meters */
export const HAND_ACCURACY = 10;

export type { Place };

/**
 * Plek met de hand gezet (tikken of slepen op de kaart). De GPS-positie
 * blijft bewaard in `recordedPosition`, ook als de plek vaker verzet wordt.
 * Als meettijd de tijd van de waarneming, zodat er geen "positie oud" staat.
 * Met "Huidige locatie" op het kaartje de nauwkeurigheid van die GPS-meting
 * (afgerond, niet beter dan HAND_ACCURACY).
 */
export function placeByHand(
  current: Place,
  observedAt: number,
  lat: number,
  lon: number,
  accuracy = HAND_ACCURACY,
): Place {
  return {
    position: {
      lat,
      lon,
      accuracy: Math.max(HAND_ACCURACY, Math.round(accuracy)),
      fixedAt: observedAt,
    },
    placedByVoice: undefined,
    recordedPosition:
      current.recordedPosition !== undefined
        ? current.recordedPosition
        : (current.position ?? null),
  };
}

/**
 * Alle waarnemingen van een sessie zonder plek in één keer op dezelfde plek
 * (bv. een trektelling zonder GPS-fix). De gekozen plek geldt als waar de
 * gebruiker stond: een gezegde plek ("500 m zuid") wordt daarvandaan
 * uitgerekend, zoals bij een GPS-positie die later binnenkomt; de rest krijgt
 * de plek zoals met de hand gezet. Geeft de id's van de verzette waarnemingen.
 */
export async function placeUnplaced(
  sessionId: string,
  lat: number,
  lon: number,
  accuracy = HAND_ACCURACY,
): Promise<string[]> {
  const ids: string[] = [];
  await db.observations
    .where('sessionId')
    .equals(sessionId)
    .filter((obs) => !obs.position)
    .modify((obs) => {
      ids.push(obs.id);
      if (obs.spokenPlace) {
        const stood = {
          lat,
          lon,
          accuracy: Math.max(HAND_ACCURACY, Math.round(accuracy)),
          fixedAt: obs.observedAt,
        };
        Object.assign(obs, placeFromSpeech(stood, obs.spokenPlace));
      } else {
        Object.assign(obs, placeByHand(obs, obs.observedAt, lat, lon, accuracy));
      }
    });
  return ids;
}

/** Terug naar de plek van de GPS ("Terug naar de opgenomen plek") */
export function recordedPlace(current: Place): Place {
  if (current.recordedPosition === undefined) return current;
  return {
    position: current.recordedPosition ?? undefined,
    recordedPosition: undefined,
    placedByVoice: undefined,
  };
}

/**
 * Kopie van een waarneming, om er in de review een tweede van te maken ("4
 * wilde eenden en een winterkoning" werd alleen een winterkoning). Zelfde
 * tijd, locatie, bron-uitspraak en velden, maar een eigen id (gaat mee naar
 * waarneming.nl), als concept en niet onzeker. Geeft het nieuwe id terug.
 */
export async function copyObservation(id: string): Promise<string | undefined> {
  const original = await db.observations.get(id);
  if (!original) return undefined;
  const {
    editedAt: _edited,
    uncertainReason: _reason,
    candidates: _candidates,
    skipExport: _skip,
    ...fields
  } = original;
  const copy: Observation = {
    ...fields,
    id: crypto.randomUUID(),
    // Later aangemaakt, dus in de lijst direct boven het origineel
    createdAt: Math.max(Date.now(), original.createdAt + 1),
    uncertain: false,
    status: 'draft',
  };
  await db.observations.add(copy);
  return copy.id;
}

/** Onzekere waarneming nagelopen en goed bevonden ("Klopt") */
export async function confirmObservation(id: string): Promise<void> {
  await editObservation(id, {
    uncertain: false,
    uncertainReason: undefined,
    candidates: undefined,
  });
}

/** Twijfel tussen soorten opgelost: deze kandidaat was het */
export async function chooseCandidate(id: string, speciesId: number): Promise<void> {
  await editObservation(id, {
    speciesId,
    uncertain: false,
    uncertainReason: undefined,
    candidates: undefined,
  });
}

/**
 * Waarneming wel of niet meenemen in de export. Telt niet als correctie
 * (geen `editedAt`), want de waarneming zelf verandert niet.
 */
export async function setSkipExport(id: string, skip: boolean): Promise<void> {
  await db.observations.update(id, { skipExport: skip || undefined });
}

/** Verwijderde waarnemingen van een sessie, laatst verwijderd eerst. */
export async function listDeleted(sessionId: string): Promise<DeletedObservation[]> {
  const all = await db.deletedObservations.where('sessionId').equals(sessionId).toArray();
  return all.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Verwijdert een waarneming met de hand; hij gaat naar de prullenbak. */
export async function deleteObservation(id: string): Promise<void> {
  await db.transaction('rw', db.observations, db.deletedObservations, () => moveToBin(id, 'hand'));
}

/** Zet een verwijderde waarneming terug in de lijst. */
export async function restoreObservation(id: string): Promise<void> {
  await db.transaction('rw', db.observations, db.deletedObservations, async () => {
    const deleted = await db.deletedObservations.get(id);
    if (!deleted) return;
    const { deletedAt: _at, deletedBy: _by, ...observation } = deleted;
    await db.observations.put(observation);
    await db.deletedObservations.delete(id);
  });
}

/** Verplaatst een waarneming naar de prullenbak; geeft hem terug zoals hij was. */
export async function moveToBin(
  id: string,
  deletedBy: DeletedObservation['deletedBy'],
): Promise<Observation | undefined> {
  const observation = await db.observations.get(id);
  if (!observation) return undefined;
  await db.deletedObservations.put({ ...observation, deletedAt: Date.now(), deletedBy });
  await db.observations.delete(id);
  return observation;
}

/** Aantal soorten, zonder verzamelsoorten ("Eend onbekend") */
export function countSpecies(observations: Observation[]): number {
  return new Set(
    observations
      .filter((obs) => getSpecies(obs.speciesId)?.type !== 'M')
      .map((obs) => obs.speciesId),
  ).size;
}
