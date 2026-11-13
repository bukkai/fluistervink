<script lang="ts">
  import { type Observation, type Utterance } from './db';
  import { player } from './player.svelte';
  import LocationPicker from './LocationPicker.svelte';
  import LocationPreview from './LocationPreview.svelte';
  import { placeReason } from './spokenPlace';
  import {
    copyObservation,
    deleteObservation,
    editObservation,
    placeByHand,
    recordedPlace,
    type Place,
  } from './observations';
  import { untrack } from 'svelte';
  import { devOptionOn } from './devOptions';
  import type { Code } from './vocab';
  import {
    BIRDS,
    codesFor,
    convertCodes,
    countingMethods,
    getSpecies,
    groupLabel,
    groupOf,
    selectableSpecies,
  } from './vocab';

  // Formulier om één waarneming met de hand te corrigeren, in de review.

  let {
    observation,
    utterance,
    onclose,
    oncopy,
  }: {
    observation: Observation;
    utterance?: Utterance;
    onclose: () => void;
    /** Zonder: geen knop Kopiëren (bv. bij het nalopen van de onzekere) */
    oncopy?: (id: string) => void;
  } = $props();

  // Kopie van de waarneming bij het openen; pas bij "Opslaan" naar de database
  // svelte-ignore state_referenced_locally
  const original = observation;
  let speciesName = $state(getSpecies(original.speciesId)?.name ?? '');
  let count = $state(original.count);
  let countingMethodId = $state(original.countingMethodId);
  let activityId = $state(original.activityId);
  let methodId = $state(original.methodId);
  let lifeStageId = $state(original.lifeStageId);
  let sex = $state(original.sex === 'unknown' ? undefined : original.sex);
  let remarks = $state(original.remarks ?? '');
  let privateNote = $state(original.privateNote ?? '');
  let uncertain = $state(original.uncertain);
  /** Plek en bewaarde GPS-plek; pas bij "Opslaan" naar de database */
  let place = $state.raw<Place>({
    position: original.position,
    recordedPosition: original.recordedPosition,
    placedByVoice: original.placedByVoice,
  });
  let placing = $state(false);
  /** Niet meer op de GPS-positie: met de hand gezet of volgens de uitspraak */
  let moved = $derived(place.recordedPosition !== undefined);

  // Andere dieren dan vogels met de ontwikkeloptie, of als deze waarneming er al een is
  const choices = selectableSpecies(
    devOptionOn('soortgroepen') || groupOf(original.speciesId) !== BIRDS,
  );
  const speciesByName = new Map(choices.map((s) => [s.name.toLowerCase(), s]));
  let selectedSpecies = $derived(speciesByName.get(speciesName.trim().toLowerCase()));

  // Gedrag, methode en kleed horen bij de groep van de soort ("ter plaatse" is
  // 1 bij vogels, 15 bij zoogdieren). Een andere groep gekozen: omzetten.
  let codesSpeciesId = $state(original.speciesId);
  let codes = $derived(codesFor(codesSpeciesId));
  $effect(() => {
    const id = selectedSpecies?.id;
    if (id === undefined) return;
    untrack(() => {
      if (id === codesSpeciesId) return;
      const converted = convertCodes({ activityId, methodId, lifeStageId }, codesSpeciesId, id);
      activityId = converted.activityId;
      methodId = converted.methodId;
      lifeStageId = converted.lifeStageId;
      codesSpeciesId = id;
    });
  });
  let valid = $derived(selectedSpecies !== undefined && Number.isInteger(count) && count >= 1);

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedSpecies) return;
    await editObservation(original.id, {
      speciesId: selectedSpecies.id,
      count,
      countingMethodId,
      activityId,
      methodId,
      lifeStageId,
      sex,
      remarks: remarks.trim() || undefined,
      privateNote: privateNote.trim() || undefined,
      uncertain,
      uncertainReason: uncertain ? original.uncertainReason : undefined,
      candidates:
        uncertain && selectedSpecies.id === original.speciesId ? original.candidates : undefined,
      position: place.position,
      recordedPosition: place.recordedPosition,
      placedByVoice: place.placedByVoice,
    });
    onclose();
  }

  /** De app twijfelde alleen over de plek ("aan de overkant van de rivier") */
  const onlyPlaceDoubt =
    original.uncertain &&
    !!original.spokenPlace &&
    original.uncertainReason === placeReason(original.spokenPlace);

  function setPlace(lat: number, lon: number, accuracy?: number) {
    place = placeByHand(place, original.observedAt, lat, lon, accuracy);
    // Plek gezet: die twijfel is opgelost
    if (onlyPlaceDoubt) uncertain = false;
  }

  function backToRecorded() {
    place = recordedPlace(place);
    // Weer de plek van de gebruiker: de twijfel over de plek komt terug
    if (onlyPlaceDoubt) uncertain = true;
  }

  async function remove() {
    // Geen bevestiging nodig: hij komt in "Verwijderd" en is terug te zetten
    await deleteObservation(original.id);
    onclose();
  }

  /**
   * Nieuwe waarneming met dezelfde tijd, plek en velden, die meteen open gaat
   * om aan te passen. Gekopieerd wordt de opgeslagen versie: wijzigingen die
   * nog niet opgeslagen zijn, gaan niet mee.
   */
  async function copy() {
    const id = await copyObservation(original.id);
    if (id) oncopy?.(id);
  }
</script>

<form onsubmit={save}>
  {#if utterance?.transcript}
    <p class="source">
      {#if utterance.audio}
        <button
          type="button"
          class="play"
          onclick={() => player.toggle(utterance!.id, utterance!.audio!)}
          aria-label={player.label(utterance.id)}>{player.symbol(utterance.id)}</button
        >
      {:else if utterance.audioDeletedAt}
        <span class="muted">(opname gewist)</span>
      {/if}
      “{utterance.transcript}”
    </p>
  {/if}

  <div class="row">
    <label class="species">
      Soort
      <input
        list="soorten"
        bind:value={speciesName}
        autocomplete="off"
        aria-invalid={!selectedSpecies}
        onfocus={(event) => event.currentTarget.select()}
      />
    </label>
    <label class="count">
      Aantal
      <input type="number" min="1" inputmode="numeric" bind:value={count} />
    </label>
  </div>
  {#if !selectedSpecies}
    <p class="error">Kies een soort uit de lijst.</p>
  {/if}

  <div class="row">
    <label>
      Gedrag
      <select bind:value={activityId}>
        <option value={undefined}>—</option>
        {@render options(codes.activities, codes.allActivities)}
      </select>
    </label>
    <label>
      Methode
      <select bind:value={methodId}>
        <option value={undefined}>—</option>
        {@render options(codes.methods, codes.allMethods)}
      </select>
    </label>
  </div>

  <div class="row">
    <label>
      Kleed/leeftijd
      <select bind:value={lifeStageId}>
        <option value={undefined}>—</option>
        {@render options(codes.lifeStages, codes.allLifeStages)}
      </select>
    </label>
    <label>
      Geslacht
      <select bind:value={sex}>
        <option value={undefined}>—</option>
        <option value="male">man</option>
        <option value="female">vrouw</option>
      </select>
    </label>
  </div>

  <label>
    Telmethode
    <select bind:value={countingMethodId}>
      {#each countingMethods as code (code.id)}
        <option value={code.id}>{code.name}</option>
      {/each}
    </select>
  </label>

  <div class="place">
    <span class="place-label">Locatie</span>
    <span class="place-row">
      <span>
        {#if !place.position}
          geen locatie
        {:else if place.placedByVoice}
          volgens de uitspraak, ±{place.position.accuracy} m
        {:else if moved}
          met de hand gezet (±{place.position.accuracy} m)
        {:else}
          GPS, ±{Math.round(place.position.accuracy)} m
        {/if}
      </span>
      {#if !placing}
        <button type="button" class="link pin-link" onclick={() => (placing = true)}>
          <!-- Kaartspeld, zoals in kaart-apps -->
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M12 22s7-7.1 7-12.5A7 7 0 0 0 5 9.5C5 14.9 12 22 12 22Z"
              fill="var(--breast)"
              stroke="var(--breast-strong)"
              stroke-width="1.25"
            />
            <circle cx="12" cy="9.5" r="2.6" fill="#fff" />
          </svg>
          Locatie aanpassen
        </button>
      {/if}
    </span>
    {#if original.spokenPlace}
      <span class="spoken">Gezegd: {original.spokenPlace.text}</span>
    {/if}
    {#if placing}
      <LocationPicker position={place.position} sessionId={original.sessionId} onplace={setPlace} />
    {:else if place.position}
      <LocationPreview position={place.position} onopen={() => (placing = true)} />
    {/if}
    {#if moved}
      <button type="button" class="link back" onclick={backToRecorded}>
        Terug naar de opgenomen plek{place.recordedPosition ? '' : ' (geen locatie)'}
      </button>
    {/if}
  </div>

  <label>
    Eigen notitie (gaat niet mee in de export)
    <textarea bind:value={privateNote} rows="2"></textarea>
  </label>

  <label>
    Opmerking voor waarneming.nl
    <textarea bind:value={remarks} rows="2"></textarea>
  </label>

  <label class="check">
    <input type="checkbox" bind:checked={uncertain} />
    Onzeker{original.uncertainReason ? ` (${original.uncertainReason})` : ''}
  </label>

  <div class="buttons">
    <button type="submit" class="btn" disabled={!valid}>Opslaan</button>
    <button type="button" class="btn secondary" onclick={onclose}>Annuleren</button>
    <span class="more">
      {#if oncopy}
        <button type="button" class="link" onclick={copy}>Kopiëren</button>
      {/if}
      <button type="button" class="link danger" onclick={remove}>Verwijderen</button>
    </span>
  </div>
</form>

<datalist id="soorten">
  {#each choices as s (s.id)}
    <option value={s.name}>{groupLabel(s.id)}</option>
  {/each}
</datalist>

<!-- Wat je in het veld zegt bovenaan, de rest van waarneming.nl eronder -->
{#snippet options(field: Code[], all: Code[])}
  {#each field as code (code.id)}
    <option value={code.id}>{code.name}</option>
  {/each}
  <optgroup label="Meer">
    {#each all.filter((code) => !field.includes(code)) as code (code.id)}
      <option value={code.id}>{code.name}</option>
    {/each}
  </optgroup>
{/snippet}

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 0.25rem 0 0.25rem;
  }

  .row {
    display: flex;
    gap: 0.5rem;
  }

  .row > label {
    flex: 1;
    min-width: 0;
  }

  .row > .count {
    flex: 0 0 5rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
  }

  label.check {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 400;
    color: var(--fg);
  }

  label :global(input),
  label :global(select),
  label :global(textarea) {
    font-weight: 400;
  }

  input[aria-invalid='true'] {
    border-color: var(--red);
  }

  .check input {
    width: 1.25rem;
    height: 1.25rem;
  }

  .place {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .place-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
  }

  .place-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem 1rem;
    font-size: 0.95rem;
  }

  .pin-link {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }

  .pin-link svg {
    flex: none;
  }

  .place .back {
    align-self: flex-start;
  }

  .spoken {
    font-size: 0.95rem;
    font-style: italic;
    color: var(--muted);
  }

  .source {
    margin: 0;
    font-size: 0.95rem;
    font-style: italic;
    color: var(--muted);
  }

  .error {
    margin: 0;
    font-size: 0.8rem;
    color: var(--red);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 0.5rem;
    margin-top: 0.25rem;
  }

  /* Samen naar rechts, of samen naar de volgende regel als het niet past */
  .more {
    display: flex;
    gap: 1.25rem;
    margin-left: auto;
  }

  button.play {
    margin-right: 0.25rem;
    padding: 0 0.5rem;
    border: none;
    border-radius: 0.4rem;
    font-size: 0.8rem;
    font-style: normal;
    color: white;
    background: var(--brand);
  }
</style>
