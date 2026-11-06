<script lang="ts">
  import { audioBlob, type Observation, type Utterance } from './db';
  import LocationPicker from './LocationPicker.svelte';
  import {
    copyObservation,
    deleteObservation,
    editObservation,
    placeByHand,
    recordedPlace,
    type Place,
  } from './observations';
  import type { Code } from './vocab';
  import {
    activities,
    allActivities,
    allLifeStages,
    allMethods,
    allSpecies,
    countingMethods,
    getSpecies,
    lifeStages,
    methods,
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
  });
  let placing = $state(false);
  let byHand = $derived(place.recordedPosition !== undefined);

  const speciesByName = new Map(allSpecies.map((s) => [s.name.toLowerCase(), s]));
  let selectedSpecies = $derived(speciesByName.get(speciesName.trim().toLowerCase()));
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
      position: place.position,
      recordedPosition: place.recordedPosition,
    });
    onclose();
  }

  function setPlace(lat: number, lon: number) {
    place = placeByHand(place, original.observedAt, lat, lon);
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

  /** Speelt de opname af waaruit deze waarneming kwam. */
  function play() {
    const url = URL.createObjectURL(audioBlob(utterance!.audio!));
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  }
</script>

<form onsubmit={save}>
  {#if utterance?.transcript}
    <p class="source">
      {#if utterance.audio}
        <button type="button" class="play" onclick={play} aria-label="Opname afspelen">▶</button>
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
        {@render options(activities, allActivities)}
      </select>
    </label>
    <label>
      Methode
      <select bind:value={methodId}>
        <option value={undefined}>—</option>
        {@render options(methods, allMethods)}
      </select>
    </label>
  </div>

  <div class="row">
    <label>
      Kleed/leeftijd
      <select bind:value={lifeStageId}>
        <option value={undefined}>—</option>
        {@render options(lifeStages, allLifeStages)}
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
        {:else if byHand}
          met de hand gezet (±{place.position.accuracy} m)
        {:else}
          GPS, ±{Math.round(place.position.accuracy)} m
        {/if}
      </span>
      {#if !placing}
        <button type="button" class="link" onclick={() => (placing = true)}
          >Locatie aanpassen</button
        >
      {/if}
    </span>
    {#if placing}
      <LocationPicker position={place.position} sessionId={original.sessionId} onplace={setPlace} />
    {/if}
    {#if byHand}
      <button type="button" class="link back" onclick={() => (place = recordedPlace(place))}>
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
  {#each allSpecies as s (s.id)}
    <option value={s.name}></option>
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

  .place .back {
    align-self: flex-start;
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
