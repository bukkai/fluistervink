import { db, type Change, type Observation, type Utterance } from './db';
import type { Action } from './interpret';
import { codesForNewSpecies, listUtterances, moveToBin } from './observations';
import { preferenceOn } from './preferences';
import { rarityOf } from './rarity';
import { placeFromSpeech, placeReason } from './spokenPlace';
import { codesFor, DEFAULT_COUNTING_METHOD, isVagrant, speciesName } from './vocab';

// Voert de acties van het model uit (toevoegen, aanpassen, verwijderen,
// ongedaan maken) en beslist daarbij wat onzeker wordt. Aangeroepen vanuit de
// wachtrij (queue.ts), binnen één databasetransactie per uitspraak.

/** Vanaf deze lengte valt een opname met (bijna) geen tekst op. */
const ACCIDENTAL_MIN_MS = 3_500;
/** Minder woorden per seconde dan dit = (bijna) geen spraak. */
const ACCIDENTAL_MAX_WORDS_PER_S = 0.3;
/** Zoveel woorden verzint de spraakherkenning niet uit geritsel */
const ACCIDENTAL_MAX_WORDS = 6;

/**
 * Een opname met bijna geen tekst voor zijn lengte is vrijwel zeker per ongeluk
 * gemaakt (in de broekzak): de spraakherkenning verzint dan een paar woorden
 * uit het geritsel, vaak een soortnaam uit de prompt. 12 okt: 20 s opname,
 * "Roodhalsfuut" (0,05 woord/s), en in de bus 3,9 s "Bosuil" (0,26 woord/s).
 * Echte uitspraken halen 0,5 of meer, ook één soortnaam ("Boomklever", 1,9 s).
 * Een echte trage uitspraak wordt hooguit onzeker, en dat zie je bij het nalopen.
 * Niet bij een lijst van zes woorden of meer, en niet in de trektelmodus: wie
 * naar de lucht kijkt en tussendoor soorten noemt, haalt makkelijk minder dan
 * 0,3 woord/s (Maarten, 8 nov: 45 s, 13 woorden, alles werd onzeker). Daar
 * houdt de spraakdetectie stille stukken al tegen.
 * Volume en de zekerheid van de spraakherkenning bleken geen goed signaal:
 * geritsel is luider dan fluisteren, en de zekerheid wisselt per poging.
 */
export function isAccidental(
  utterance: Pick<
    Utterance,
    'audioDurationMs' | 'transcript' | 'audio' | 'audioDeletedAt' | 'trektel'
  >,
): boolean {
  if (utterance.trektel) return false;
  const ms = utterance.audioDurationMs;
  // Opgenomen (ook als de opname daarna gewist is), niet getypt
  const recorded = !!utterance.audio || utterance.audioDeletedAt !== undefined;
  if (!recorded || !ms || ms < ACCIDENTAL_MIN_MS) return false;
  const words = (utterance.transcript ?? '').split(/\s+/).filter(Boolean).length;
  if (words >= ACCIDENTAL_MAX_WORDS) return false;
  return words / (ms / 1000) < ACCIDENTAL_MAX_WORDS_PER_S;
}

/** Woorden die laten zien dat "nee …" echt een correctie is */
const CORRECTION_WORDS = new Set([
  'die',
  'dat',
  'het',
  'was',
  'is',
  'zijn',
  'waren',
  'niet',
  'geen',
  'plaats',
  'laatste',
  'vorige',
  'toch',
]);

/**
 * Alleen "nee" en een soortnaam ("Nee, waterhoen."): in de wind kan dat ook
 * "een waterhoen" zijn geweest. Jurian, 4 nov: daardoor werden de twee
 * krakeenden ervoor stil twee waterhoenders. Wie echt corrigeert, zegt meestal
 * meer ("nee, die laatste was een gaai", "nee, keep in plaats van vink").
 */
export function isBareNo(transcript: string | undefined): boolean {
  const words = (transcript ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words[0] !== 'nee' || words.length < 2 || words.length > 4) return false;
  return !words.slice(1).some((word) => CORRECTION_WORDS.has(word));
}

/** Velden die een onzekere waarneming bij een update niet zeker maken */
const NOT_A_CORRECTION: string[] = ['remarks', 'privateNote', 'spokenPlace'];

/**
 * Een plek die niet uit te rekenen is ("aan de overkant van de rivier") maakt
 * de waarneming onzeker, zodat hij bij het nalopen op de kaart gezet wordt.
 * Een reden van het model blijft staan.
 */
function placeUncertainty(
  fields: Partial<Pick<Observation, 'spokenPlace' | 'uncertain' | 'uncertainReason'>>,
): Pick<Observation, 'uncertain' | 'uncertainReason'> | undefined {
  const reason = fields.spokenPlace && placeReason(fields.spokenPlace);
  if (!reason) return undefined;
  const earlier = fields.uncertain ? fields.uncertainReason : undefined;
  if (earlier?.includes(reason)) return { uncertain: true, uncertainReason: earlier };
  return { uncertain: true, uncertainReason: earlier ? `${earlier}; ${reason}` : reason };
}

/** Zeldzaam (3) of zeer zeldzaam (4) bij waarneming.nl */
const RARE = 3;

/**
 * Twijfel erbij zetten, met de reden achter een eventuele eerdere reden.
 * Instelling (preferences.ts): zeldzame soort.
 */
function withReason(
  fields: Pick<Observation, 'uncertain' | 'uncertainReason'>,
  reason: string | undefined,
): Pick<Observation, 'uncertain' | 'uncertainReason'> {
  if (!reason) return fields;
  const earlier = fields.uncertain ? fields.uncertainReason : undefined;
  if (earlier?.includes(reason)) return { uncertain: true, uncertainReason: earlier };
  return { uncertain: true, uncertainReason: earlier ? `${earlier}; ${reason}` : reason };
}

/**
 * De meeste fouten zijn verwisselingen met een andere echte vogelnaam. Kiest
 * de app een zeldzame soort, dan onzeker, zodat hij bij het nalopen bovenaan
 * staat (instelling, standaard aan).
 */
export function rareReason(speciesId: number): string | undefined {
  if (!preferenceOn('zeldzaamOnzeker') || rarityOf(speciesId) < RARE) return undefined;
  // Een dwaalgast is al onzeker, met zijn eigen reden (interpret.ts)
  if (isVagrant(speciesId)) return undefined;
  return `Zeldzame soort (${speciesName(speciesId)}): klopt het?`;
}

/** Voert de acties uit en geeft terug wat er veranderde. */
export async function applyActions(utterance: Utterance, actions: Action[]): Promise<Change[]> {
  const changes: Change[] = [];
  let order = Date.now();
  // Waarschijnlijk per ongeluk opgenomen: alles wat eruit komt onzeker, zodat
  // het bij het nalopen opvalt
  const accidental: Partial<Observation> = isAccidental(utterance)
    ? {
        uncertain: true,
        uncertainReason: `Per ongeluk opgenomen? ${Math.round(utterance.audioDurationMs! / 1000)} s opname, verstaan: "${utterance.transcript}"`,
      }
    : {};

  for (const action of actions) {
    switch (action.type) {
      case 'add': {
        const observation: Observation = {
          id: crypto.randomUUID(),
          sessionId: utterance.sessionId,
          utteranceId: utterance.id,
          countingMethodId: DEFAULT_COUNTING_METHOD,
          // Ter plaatse en gezien, in de codes van de groep van de soort
          activityId: codesFor(action.fields.speciesId).defaultActivity,
          methodId: codesFor(action.fields.speciesId).defaultMethod,
          ...action.fields,
          uncertain: action.fields.uncertain ?? false,
          ...placeUncertainty(action.fields),
          ...accidental,
          observedAt: utterance.recordedAt,
          createdAt: order++,
          position: utterance.position,
          ...(action.fields.spokenPlace &&
            utterance.position &&
            placeFromSpeech(utterance.position, action.fields.spokenPlace)),
          area: utterance.area,
          status: 'draft',
        };
        Object.assign(observation, withReason(observation, rareReason(observation.speciesId)));
        await db.observations.add(observation);
        changes.push({ type: 'add', observationId: observation.id });
        break;
      }

      case 'update': {
        const current = await db.observations.get(action.observationId);
        if (!current) break;
        const patch: Partial<Observation> = { ...action.fields };
        Object.assign(patch, codesForNewSpecies(current, patch));
        if (action.addCount) {
          patch.count = Math.max(1, (patch.count ?? current.count) + action.addCount);
        }
        // Een correctie zonder twijfel maakt een eerder onzekere waarneming
        // zeker; alleen een opmerking of notitie toevoegen niet
        const onlyRemarks =
          !action.addCount &&
          Object.keys(action.fields).every((key) => NOT_A_CORRECTION.includes(key));
        if (!onlyRemarks) {
          patch.uncertain ??= false;
          if (!patch.uncertain) patch.uncertainReason = undefined;
        }
        if (
          action.fields.speciesId !== undefined &&
          action.fields.speciesId !== current.speciesId &&
          isBareNo(utterance.transcript)
        ) {
          const reason = `Alleen "${utterance.transcript!.trim()}" verstaan; misschien "een …" (nieuwe waarneming). Was ${current.count} × ${speciesName(current.speciesId)}`;
          patch.uncertain = true;
          patch.uncertainReason = patch.uncertainReason
            ? `${patch.uncertainReason}; ${reason}`
            : reason;
        }
        // Kandidaten horen bij de twijfel over de soort: weg als de twijfel weg
        // is, of als er een andere soort gekozen is zonder nieuwe kandidaten
        if (
          current.candidates &&
          !action.fields.candidates &&
          (patch.uncertain === false ||
            (action.fields.speciesId !== undefined &&
              action.fields.speciesId !== current.speciesId))
        ) {
          patch.candidates = undefined;
        }
        if (action.fields.spokenPlace) {
          // Opnieuw vanaf de GPS-positie van de gebruiker, niet vanaf de vorige plek
          const gps =
            current.recordedPosition !== undefined
              ? (current.recordedPosition ?? undefined)
              : current.position;
          if (gps) Object.assign(patch, placeFromSpeech(gps, action.fields.spokenPlace));
          // De vorige plek is vervangen: zijn twijfel ("zet hem op de kaart") ook
          const merged = { ...current, ...patch };
          const stale = current.spokenPlace && placeReason(current.spokenPlace);
          if (stale && merged.uncertainReason?.includes(stale)) {
            // De reden bevat zelf "; ", dus vervangen in plaats van splitsen
            const rest = merged.uncertainReason
              .replace(`; ${stale}`, '')
              .replace(stale, '')
              .replace(/^; /, '');
            patch.uncertainReason = merged.uncertainReason = rest || undefined;
            if (!rest) patch.uncertain = merged.uncertain = false;
          }
          Object.assign(patch, placeUncertainty(merged));
        }
        Object.assign(patch, accidental);
        // Andere soort: is die zeldzaam (instelling)?
        if (
          action.fields.speciesId !== undefined &&
          action.fields.speciesId !== current.speciesId
        ) {
          const merged = { ...current, ...patch };
          Object.assign(patch, withReason(merged, rareReason(action.fields.speciesId)));
        }

        const before = Object.fromEntries(
          Object.keys(patch).map((key) => [key, current[key as keyof Observation]]),
        ) as Partial<Observation>;
        await db.observations.update(current.id, patch);
        changes.push({ type: 'update', observationId: current.id, before });
        break;
      }

      case 'delete': {
        const current = await moveToBin(action.observationId, 'voice');
        if (!current) break;
        changes.push({ type: 'delete', observation: current });
        break;
      }

      case 'undo':
        await undoPrevious(utterance);
        break;

      case 'redo':
        await redoUndo(utterance);
        break;

      case 'dev_note':
        // Geen wijziging aan waarnemingen; de uitspraak wordt een dev note
        break;
    }
  }
  return changes;
}

/** Draait de meest recente, nog niet teruggedraaide uitspraak terug. */
async function undoPrevious(utterance: Utterance): Promise<void> {
  const previous = (await listUtterances(utterance.sessionId)).find(
    (u) =>
      u.id !== utterance.id &&
      u.recordedAt <= utterance.recordedAt &&
      u.status === 'done' &&
      !u.undone &&
      u.changes?.length,
  );
  if (!previous) return;

  const changes = await revert(previous.changes!);
  await db.utterances.update(previous.id, { undone: true });
  await db.utterances.update(utterance.id, { undid: { utteranceId: previous.id, changes } });
}

/**
 * Draait de meest recente undo terug ("toch niet ongedaan maken"). Daarna is
 * die undo zelf teruggedraaid, en kan een nieuwe undo de oorspronkelijke
 * uitspraak weer terugdraaien.
 */
async function redoUndo(utterance: Utterance): Promise<void> {
  const undo = (await listUtterances(utterance.sessionId)).find(
    (u) => u.id !== utterance.id && u.recordedAt <= utterance.recordedAt && !u.undone && u.undid,
  );
  if (!undo) return;

  await revert(undo.undid!.changes);
  await db.utterances.update(undo.undid!.utteranceId, { undone: false });
  await db.utterances.update(undo.id, { undone: true });
}

/**
 * Draait wijzigingen terug, de laatste eerst, en geeft terug wat dat zelf
 * veranderde (in dezelfde vorm, zodat ook dat weer terug kan).
 */
async function revert(changes: Change[]): Promise<Change[]> {
  const reverted: Change[] = [];
  for (const change of [...changes].reverse()) {
    if (change.type === 'add') {
      const observation = await moveToBin(change.observationId, 'undo');
      if (observation) reverted.push({ type: 'delete', observation });
    }
    if (change.type === 'update') {
      const current = await db.observations.get(change.observationId);
      if (!current) continue;
      const before = Object.fromEntries(
        Object.keys(change.before).map((key) => [key, current[key as keyof Observation]]),
      ) as Partial<Observation>;
      await db.observations.update(change.observationId, change.before);
      reverted.push({ type: 'update', observationId: change.observationId, before });
    }
    if (change.type === 'delete') {
      await db.observations.put(change.observation);
      await db.deletedObservations.delete(change.observation.id);
      reverted.push({ type: 'add', observationId: change.observation.id });
    }
  }
  return reverted;
}
